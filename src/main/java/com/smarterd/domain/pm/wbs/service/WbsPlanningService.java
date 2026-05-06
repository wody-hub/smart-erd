package com.smarterd.domain.pm.wbs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.entity.WbsTemplate;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsTemplateRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WBS planning 2차 기능(복제/템플릿/대량생성)을 제공한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WbsPlanningService {

    private static final TypeReference<TemplatePayload> TEMPLATE_PAYLOAD_TYPE = new TypeReference<>() {};

    private final WbsItemRepository wbsItemRepository;
    private final WbsDependencyRepository wbsDependencyRepository;
    private final WbsTemplateRepository wbsTemplateRepository;
    private final MilestoneRepository milestoneRepository;
    private final ProjectContextLoader projectContextLoader;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final WbsScheduleMetricsService wbsScheduleMetricsService;

    public List<WbsTemplateSummaryResult> getTemplates(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return wbsTemplateRepository.findByProjectOrderByUpdatedAtDescIdDesc(context.project()).stream().map(this::toTemplateSummary).toList();
    }

    @Transactional
    public WbsMutationResult duplicateSubtree(
        String loginId,
        Long teamId,
        Long projectId,
        Long sourceWbsItemId,
        DuplicateSubtreeCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var snapshot = snapshotSubtree(context.project(), sourceWbsItemId);
        return instantiateSnapshot(context.team(), context.project(), snapshot, command.toInstantiationCommand());
    }

    @Transactional
    public WbsTemplateSummaryResult saveTemplate(String loginId, Long teamId, Long projectId, SaveTemplateCommand command) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var payload = snapshotSubtree(context.project(), command.sourceWbsItemId());
        final var serialized = serializePayload(payload);
        final var template = WbsTemplate.builder()
            .project(context.project())
            .name(command.name())
            .description(command.description())
            .rootName(payload.rootName())
            .itemCount(payload.nodes().size())
            .dependencyCount(payload.dependencies().size())
            .payloadJson(serialized)
            .build();
        wbsTemplateRepository.save(template);
        return toTemplateSummary(template);
    }

    @Transactional
    public WbsMutationResult instantiateTemplate(
        String loginId,
        Long teamId,
        Long projectId,
        Long templateId,
        InstantiateTemplateCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var template = wbsTemplateRepository
            .findByProjectAndId(context.project(), templateId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), templateId));
        final var payload = deserializePayload(template.getPayloadJson());
        return instantiateSnapshot(context.team(), context.project(), payload, command);
    }

    @Transactional
    public BulkCreateResult bulkCreate(String loginId, Long teamId, Long projectId, BulkCreateCommand command) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        validateBulkCreateItems(command.items());

        final var unresolved = new LinkedHashMap<String, BulkCreateItemCommand>();
        for (final var item : command.items()) {
            unresolved.put(item.clientKey(), item);
        }

        final Map<String, WbsItem> createdByClientKey = new LinkedHashMap<>();
        final Map<ParentRef, Integer> nextSortOrderByParent = new HashMap<>();
        final var createdResults = new ArrayList<BulkCreateItemResult>();

        while (!unresolved.isEmpty()) {
            boolean progressed = false;
            for (final var entry : List.copyOf(unresolved.entrySet())) {
                final var item = entry.getValue();
                final WbsItem parent;
                if (item.parentClientKey() != null) {
                    parent = createdByClientKey.get(item.parentClientKey());
                    if (parent == null) {
                        continue;
                    }
                } else {
                    parent = resolveParent(context.project(), item.parentId());
                }

                final var created = createItem(
                    context.team(),
                    context.project(),
                    parent,
                    item.name(),
                    item.assigneeUserId(),
                    item.startDate(),
                    item.endDate(),
                    null,
                    null,
                    item.progressRate(),
                    item.estimatedMm(),
                    item.milestoneId(),
                    nextSortOrderByParent
                );
                createdByClientKey.put(item.clientKey(), created);
                createdResults.add(new BulkCreateItemResult(item.clientKey(), toItemResult(created)));
                unresolved.remove(entry.getKey());
                progressed = true;
            }

            if (!progressed) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
        }

        return new BulkCreateResult(List.copyOf(createdResults));
    }

    private void validateBulkCreateItems(List<BulkCreateItemCommand> items) {
        final Set<String> clientKeys = new LinkedHashSet<>();
        for (final var item : items) {
            if (!clientKeys.add(item.clientKey())) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
            if (item.parentClientKey() != null && Objects.equals(item.parentClientKey(), item.clientKey())) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
        }
    }

    private WbsMutationResult instantiateSnapshot(
        Team team,
        Project project,
        TemplatePayload payload,
        InstantiateTemplateCommand command
    ) {
        final var targetParent = resolveParent(project, command.parentId());
        final Map<String, WbsItem> createdByStableKey = new LinkedHashMap<>();
        final Map<ParentRef, Integer> nextSortOrderByParent = new HashMap<>();
        final var createdItems = new ArrayList<WbsItem>();

        final var orderedNodes = payload.nodes().stream().sorted(Comparator.comparingInt(TemplateNodePayload::order)).toList();
        for (final var node : orderedNodes) {
            final var actualParent = node.parentStableKey() == null ? targetParent : createdByStableKey.get(node.parentStableKey());
            if (node.parentStableKey() != null && actualParent == null) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }

            final var created = createItem(
                team,
                project,
                actualParent,
                node.name(),
                command.resetAssignee() ? null : node.assigneeUserId(),
                command.resetSchedule() ? null : node.startDate(),
                command.resetSchedule() ? null : node.endDate(),
                null,
                null,
                command.resetProgress() ? 0 : node.progressRate(),
                node.estimatedMm(),
                command.resetMilestone() ? null : node.milestoneId(),
                nextSortOrderByParent
            );
            createdByStableKey.put(node.stableKey(), created);
            createdItems.add(created);
        }

        final var createdDependencies = new ArrayList<WbsDependency>();
        if (command.includeDependencies()) {
            int nextSortOrder = wbsDependencyRepository.findNextSortOrder(project);
            for (final var dependencyPayload : payload.dependencies()) {
                final var predecessor = createdByStableKey.get(dependencyPayload.predecessorStableKey());
                final var successor = createdByStableKey.get(dependencyPayload.successorStableKey());
                if (predecessor == null || successor == null) {
                    continue;
                }
                final var dependency = WbsDependency.builder()
                    .project(project)
                    .predecessor(predecessor)
                    .successor(successor)
                    .dependencyType(dependencyPayload.dependencyType())
                    .sortOrder(nextSortOrder++)
                    .build();
                createdDependencies.add(wbsDependencyRepository.save(dependency));
            }
        }

        final var predecessorIdsByItemId = new HashMap<Long, List<Long>>();
        final var successorIdsByItemId = new HashMap<Long, List<Long>>();
        for (final var dependency : createdDependencies) {
            predecessorIdsByItemId.computeIfAbsent(dependency.getSuccessor().getId(), ignored -> new ArrayList<>()).add(dependency.getPredecessor().getId());
            successorIdsByItemId.computeIfAbsent(dependency.getPredecessor().getId(), ignored -> new ArrayList<>()).add(dependency.getSuccessor().getId());
        }

        return new WbsMutationResult(
            createdItems.getFirst().getId(),
            createdItems
                .stream()
                .map((item) ->
                    toItemResult(
                        item,
                        predecessorIdsByItemId.getOrDefault(item.getId(), List.of()),
                        successorIdsByItemId.getOrDefault(item.getId(), List.of())
                    )
                )
                .toList(),
            createdDependencies.stream().map(this::toDependencyResult).toList()
        );
    }

    private TemplatePayload snapshotSubtree(Project project, Long sourceWbsItemId) {
        final var allItems = wbsItemRepository.findByProjectWithRelations(project);
        final var itemMap = new LinkedHashMap<Long, WbsItem>();
        allItems.forEach((item) -> itemMap.put(item.getId(), item));
        final var source = itemMap.get(sourceWbsItemId);
        if (source == null) {
            throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), sourceWbsItemId);
        }

        final var descendantIds = collectDescendantIds(source, allItems);
        final var stableKeyByItemId = new LinkedHashMap<Long, String>();
        final var order = new int[] { 0 };
        final var nodes = new ArrayList<TemplateNodePayload>();
        for (final var item : orderAsTree(allItems)) {
            if (!descendantIds.contains(item.getId())) {
                continue;
            }
            stableKeyByItemId.put(item.getId(), "node-" + UUID.randomUUID());
        }
        for (final var item : orderAsTree(allItems)) {
            if (!descendantIds.contains(item.getId())) {
                continue;
            }
            final var parent = item.getParent();
            nodes.add(
                new TemplateNodePayload(
                    stableKeyByItemId.get(item.getId()),
                    parent == null || !descendantIds.contains(parent.getId()) ? null : stableKeyByItemId.get(parent.getId()),
                    item.getName(),
                    item.getAssignee() == null ? null : item.getAssignee().getId(),
                    item.getStartDate(),
                    item.getEndDate(),
                    item.getProgressRate(),
                    item.getEstimatedMm(),
                    item.getMilestone() == null ? null : item.getMilestone().getId(),
                    order[0]++
                )
            );
        }

        final var dependencies = wbsDependencyRepository
            .findByProjectWithRelations(project)
            .stream()
            .filter((dependency) ->
                descendantIds.contains(dependency.getPredecessor().getId()) &&
                descendantIds.contains(dependency.getSuccessor().getId())
            )
            .map((dependency) ->
                new TemplateDependencyPayload(
                    stableKeyByItemId.get(dependency.getPredecessor().getId()),
                    stableKeyByItemId.get(dependency.getSuccessor().getId()),
                    dependency.getDependencyType()
                )
            )
            .toList();
        return new TemplatePayload(source.getName(), nodes, dependencies);
    }

    private Set<Long> collectDescendantIds(WbsItem root, List<WbsItem> allItems) {
        final Set<Long> descendantIds = new LinkedHashSet<>();
        final var queue = new ArrayDeque<WbsItem>();
        queue.add(root);
        while (!queue.isEmpty()) {
            final var current = queue.removeFirst();
            if (!descendantIds.add(current.getId())) {
                continue;
            }
            for (final var item : allItems) {
                if (item.getParent() != null && Objects.equals(item.getParent().getId(), current.getId())) {
                    queue.addLast(item);
                }
            }
        }
        return descendantIds;
    }

    private List<WbsItem> orderAsTree(List<WbsItem> items) {
        final Map<Long, List<WbsItem>> childrenByParentId = new HashMap<>();
        final var roots = new ArrayList<WbsItem>();
        for (final var item : items) {
            if (item.getParent() == null) {
                roots.add(item);
                continue;
            }
            childrenByParentId.computeIfAbsent(item.getParent().getId(), ignored -> new ArrayList<>()).add(item);
        }
        final Comparator<WbsItem> comparator = Comparator.comparingInt(WbsItem::getSortOrder).thenComparing(WbsItem::getId);
        roots.sort(comparator);
        childrenByParentId.values().forEach((children) -> children.sort(comparator));

        final var ordered = new ArrayList<WbsItem>(items.size());
        final var stack = new ArrayDeque<WbsItem>();
        for (int i = roots.size() - 1; i >= 0; i--) {
            stack.push(roots.get(i));
        }
        while (!stack.isEmpty()) {
            final var current = stack.pop();
            ordered.add(current);
            final var children = childrenByParentId.get(current.getId());
            if (children == null) {
                continue;
            }
            for (int i = children.size() - 1; i >= 0; i--) {
                stack.push(children.get(i));
            }
        }
        return ordered;
    }

    private WbsItem createItem(
        Team team,
        Project project,
        @Nullable WbsItem parent,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId,
        Map<ParentRef, Integer> nextSortOrderByParent
    ) {
        final var depth = parent == null ? 0 : parent.getDepth() + 1;
        if (depth > WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }

        final var item = WbsItem.builder()
            .project(project)
            .parent(parent)
            .name(name)
            .depth(depth)
            .sortOrder(nextSortOrder(nextSortOrderByParent, project, parent))
            .assignee(resolveAssignee(team, assigneeUserId))
            .startDate(startDate)
            .endDate(endDate)
            .actualStartDate(actualStartDate)
            .actualEndDate(actualEndDate)
            .progressRate(progressRate == null ? 0 : progressRate)
            .estimatedMm(estimatedMm)
            .milestone(resolveMilestone(project, milestoneId))
            .build();
        return wbsItemRepository.save(item);
    }

    private int nextSortOrder(Map<ParentRef, Integer> nextSortOrderByParent, Project project, @Nullable WbsItem parent) {
        final var parentRef = ParentRef.of(parent);
        final var next = nextSortOrderByParent.computeIfAbsent(parentRef, ignored -> wbsItemRepository.findNextSortOrder(project, parent));
        nextSortOrderByParent.put(parentRef, next + 1);
        return next;
    }

    @Nullable
    private WbsItem resolveParent(Project project, @Nullable Long parentId) {
        if (parentId == null) {
            return null;
        }
        final var parent = wbsItemRepository
            .findByProjectAndId(project, parentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), parentId));
        if (parent.getDepth() >= WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }
        return parent;
    }

    @Nullable
    private User resolveAssignee(Team team, @Nullable Long assigneeUserId) {
        if (assigneeUserId == null) {
            return null;
        }
        final var user = userRepository
            .findById(assigneeUserId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), assigneeUserId));
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
        }
        return user;
    }

    @Nullable
    private Milestone resolveMilestone(Project project, @Nullable Long milestoneId) {
        if (milestoneId == null) {
            return null;
        }
        return milestoneRepository
            .findByProjectAndId(project, milestoneId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_MILESTONE.code(), milestoneId));
    }

    private String serializePayload(TemplatePayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize WBS template payload", e);
        }
    }

    private TemplatePayload deserializePayload(String payloadJson) {
        try {
            return objectMapper.readValue(payloadJson, TEMPLATE_PAYLOAD_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize WBS template payload", e);
        }
    }

    private WbsTemplateSummaryResult toTemplateSummary(WbsTemplate template) {
        return new WbsTemplateSummaryResult(
            template.getId(),
            template.getName(),
            template.getDescription(),
            template.getRootName(),
            template.getItemCount(),
            template.getDependencyCount(),
            template.getCreatedAt(),
            template.getUpdatedAt()
        );
    }

    private WbsDependencyService.WbsDependencyResult toDependencyResult(WbsDependency dependency) {
        return new WbsDependencyService.WbsDependencyResult(
            dependency.getId(),
            dependency.getPredecessor().getId(),
            dependency.getPredecessor().getName(),
            dependency.getSuccessor().getId(),
            dependency.getSuccessor().getName(),
            dependency.getDependencyType(),
            dependency.getSortOrder(),
            dependency.getCreatedAt(),
            dependency.getUpdatedAt()
        );
    }

    private WbsService.WbsItemResult toItemResult(WbsItem item) {
        return toItemResult(item, List.of(), List.of());
    }

    private WbsService.WbsItemResult toItemResult(WbsItem item, List<Long> predecessorIds, List<Long> successorIds) {
        final var assignee = item.getAssignee();
        final var milestone = item.getMilestone();
        final var scheduleMetrics = wbsScheduleMetricsService.calculate(
            item.getStartDate(),
            item.getEndDate(),
            item.getActualStartDate(),
            item.getActualEndDate(),
            item.getProgressRate()
        );
        return new WbsService.WbsItemResult(
            item.getId(),
            item.getParent() == null ? null : item.getParent().getId(),
            item.getName(),
            item.getDepth(),
            item.getSortOrder(),
            assignee == null ? null : assignee.getId(),
            assignee == null ? null : assignee.getName(),
            item.getStartDate(),
            item.getEndDate(),
            item.getActualStartDate(),
            item.getActualEndDate(),
            item.getProgressRate(),
            scheduleMetrics.plannedProgressRate(),
            scheduleMetrics.progressVarianceRate(),
            scheduleMetrics.startVarianceDays(),
            scheduleMetrics.endVarianceDays(),
            item.getEstimatedMm(),
            milestone == null ? null : milestone.getId(),
            milestone == null ? null : milestone.getName(),
            List.copyOf(predecessorIds),
            List.copyOf(successorIds),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }

    public record DuplicateSubtreeCommand(
        @Nullable Long parentId,
        boolean resetAssignee,
        boolean resetSchedule,
        boolean resetProgress,
        boolean resetMilestone,
        boolean includeDependencies
    ) {
        public InstantiateTemplateCommand toInstantiationCommand() {
            return new InstantiateTemplateCommand(
                parentId,
                resetAssignee,
                resetSchedule,
                resetProgress,
                resetMilestone,
                includeDependencies
            );
        }
    }

    public record SaveTemplateCommand(Long sourceWbsItemId, String name, @Nullable String description) {}

    public record InstantiateTemplateCommand(
        @Nullable Long parentId,
        boolean resetAssignee,
        boolean resetSchedule,
        boolean resetProgress,
        boolean resetMilestone,
        boolean includeDependencies
    ) {}

    public record BulkCreateCommand(List<BulkCreateItemCommand> items) {}

    public record BulkCreateItemCommand(
        String clientKey,
        @Nullable Long parentId,
        @Nullable String parentClientKey,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId
    ) {}

    public record BulkCreateResult(List<BulkCreateItemResult> items) {}

    public record BulkCreateItemResult(String clientKey, WbsService.WbsItemResult item) {}

    public record WbsMutationResult(
        Long rootItemId,
        List<WbsService.WbsItemResult> items,
        List<WbsDependencyService.WbsDependencyResult> dependencies
    ) {}

    public record WbsTemplateSummaryResult(
        Long id,
        String name,
        @Nullable String description,
        String rootName,
        int itemCount,
        int dependencyCount,
        Instant createdAt,
        Instant updatedAt
    ) {}

    record TemplatePayload(String rootName, List<TemplateNodePayload> nodes, List<TemplateDependencyPayload> dependencies) {}

    record TemplateNodePayload(
        String stableKey,
        @Nullable String parentStableKey,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        int progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId,
        int order
    ) {}

    record TemplateDependencyPayload(String predecessorStableKey, String successorStableKey, com.smarterd.domain.pm.wbs.entity.WbsDependencyType dependencyType) {}

    private record ParentRef(@Nullable Long parentId) {
        static ParentRef of(@Nullable WbsItem parent) {
            return new ParentRef(parent == null ? null : parent.getId());
        }
    }
}
