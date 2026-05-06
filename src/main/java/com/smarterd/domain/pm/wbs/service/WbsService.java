package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WBS 항목 관리 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WbsService {

    private final WbsItemRepository wbsItemRepository;
    private final WbsDependencyRepository wbsDependencyRepository;
    private final MilestoneRepository milestoneRepository;
    private final ProjectContextLoader projectContextLoader;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final WbsScheduleMetricsService wbsScheduleMetricsService;

    /**
     * 프로젝트의 WBS 항목을 트리 순서로 조회한다.
     *
     * @param loginId   로그인 사용자 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @returns WBS 항목 결과 목록
     */
    public List<WbsItemResult> getWbsItems(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var items = wbsItemRepository.findByProjectWithRelations(context.project());
        final var dependencies = wbsDependencyRepository.findByProjectWithRelations(context.project());
        final Map<Long, List<Long>> predecessorIdsByItemId = new HashMap<>();
        final Map<Long, List<Long>> successorIdsByItemId = new HashMap<>();

        for (final var dependency : dependencies) {
            successorIdsByItemId
                .computeIfAbsent(dependency.getPredecessor().getId(), (ignored) -> new ArrayList<>())
                .add(dependency.getSuccessor().getId());
            predecessorIdsByItemId
                .computeIfAbsent(dependency.getSuccessor().getId(), (ignored) -> new ArrayList<>())
                .add(dependency.getPredecessor().getId());
        }

        return orderAsTree(items)
            .stream()
            .map((item) ->
                toResult(
                    item,
                    predecessorIdsByItemId.getOrDefault(item.getId(), List.of()),
                    successorIdsByItemId.getOrDefault(item.getId(), List.of())
                )
            )
            .toList();
    }

    /**
     * WBS 항목을 생성한다.
     *
     * @param loginId   로그인 사용자 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param command   생성 커맨드
     * @return 생성된 WBS 항목 결과
     */
    @Transactional
    public WbsItemResult createWbsItem(String loginId, Long teamId, Long projectId, CreateWbsItemCommand command) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var parent = resolveParent(context.project(), command.parentId());
        final var depth = parent == null ? 0 : parent.getDepth() + 1;
        final var sortOrder = wbsItemRepository.findNextSortOrder(context.project(), parent);
        final var assignee = resolveAssignee(context.team(), command.assigneeUserId());
        final var milestone = resolveMilestone(context.project(), command.milestoneId());

        final var item = Objects.requireNonNull(
            WbsItem.builder()
                .project(context.project())
                .parent(parent)
                .name(command.name())
                .depth(depth)
                .sortOrder(sortOrder)
                .assignee(assignee)
                .startDate(command.startDate())
                .endDate(command.endDate())
                .actualStartDate(command.actualStartDate())
                .actualEndDate(command.actualEndDate())
                .progressRate(command.progressRate() == null ? 0 : command.progressRate())
                .estimatedMm(command.estimatedMm())
                .milestone(milestone)
                .build()
        );

        wbsItemRepository.save(item);
        return toResult(item);
    }

    /**
     * WBS 항목을 수정한다.
     *
     * @param loginId        로그인 사용자 ID
     * @param teamId         팀 ID
     * @param projectId      프로젝트 ID
     * @param wbsItemId      수정 대상 WBS 항목 ID
     * @param name           항목명
     * @param assigneeUserId 담당자 사용자 ID
     * @param startDate      시작일
     * @param endDate        종료일
     * @param progressRate   진척률
     * @param estimatedMm    예상 M/M
     * @param milestoneId    마일스톤 ID
     * @return 수정된 WBS 항목 결과
     */
    @Transactional
    public WbsItemResult updateWbsItem(
        String loginId,
        Long teamId,
        Long projectId,
        Long wbsItemId,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var item = findByProjectAndId(context.project(), wbsItemId);
        final var assignee = resolveAssignee(context.team(), assigneeUserId);
        final var milestone = resolveMilestone(context.project(), milestoneId);

        item.update(
            name,
            assignee,
            startDate,
            endDate,
            actualStartDate,
            actualEndDate,
            progressRate == null ? item.getProgressRate() : progressRate,
            estimatedMm,
            milestone
        );
        return toResult(item);
    }

    /**
     * WBS 항목을 삭제한다. 하위 항목은 DB CASCADE로 함께 삭제된다.
     *
     * @param loginId   로그인 사용자 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param wbsItemId 삭제 대상 WBS 항목 ID
     */
    @Transactional
    public void deleteWbsItem(String loginId, Long teamId, Long projectId, Long wbsItemId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var item = findByProjectAndId(context.project(), wbsItemId);
        wbsItemRepository.delete(item);
    }

    /**
     * WBS 항목을 재정렬한다.
     *
     * @param loginId   로그인 사용자 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @param commands  재정렬 커맨드 목록
     * @return 재정렬된 WBS 항목 결과 목록
     */
    @Transactional
    public List<WbsItemResult> reorderWbsItems(
        String loginId,
        Long teamId,
        Long projectId,
        List<WbsReorderCommand> commands
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        if (commands.isEmpty()) {
            final var items = wbsItemRepository.findByProjectWithRelations(context.project());
            return orderAsTree(items).stream().map(this::toResult).toList();
        }

        final var allItems = wbsItemRepository.findByProjectWithRelations(context.project());
        final Map<Long, WbsItem> itemMap = allItems
            .stream()
            .collect(
                LinkedHashMap::new,
                (map, item) -> {
                    map.put(item.getId(), item);
                },
                Map::putAll
            );

        final Map<Long, WbsReorderCommand> commandMap = new LinkedHashMap<>();
        for (final var command : commands) {
            if (commandMap.putIfAbsent(command.id(), command) != null) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
            if (!itemMap.containsKey(command.id())) {
                throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), command.id());
            }
            if (command.parentId() != null && !itemMap.containsKey(command.parentId())) {
                throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), command.parentId());
            }
            if (Objects.equals(command.id(), command.parentId())) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
        }

        final Map<Long, Integer> depthMemo = new HashMap<>();
        for (final var itemId : itemMap.keySet()) {
            computeDepth(itemId, itemMap, commandMap, depthMemo, new HashSet<>());
        }

        final var toSave = new ArrayList<WbsItem>();
        for (final var command : commandMap.values()) {
            final var item = itemMap.get(command.id());
            final var parent = command.parentId() == null ? null : itemMap.get(command.parentId());
            item.reorder(parent, depthMemo.get(command.id()), command.sortOrder());
            toSave.add(item);
        }

        wbsItemRepository.saveAll(toSave);
        return orderAsTree(allItems).stream().map(this::toResult).toList();
    }

    @Nullable
    private WbsItem resolveParent(Project project, @Nullable Long parentId) {
        if (parentId == null) {
            return null;
        }

        final var parent = findByProjectAndId(project, parentId);
        if (parent.getDepth() >= WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }
        return parent;
    }

    // TODO: 프론트엔드에 담당자 선택 UI 추가 후 활성화 (현재 FE에서 항상 null 전송)
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

    private WbsItem findByProjectAndId(Project project, Long wbsItemId) {
        return wbsItemRepository
            .findByProjectAndId(project, Objects.requireNonNull(wbsItemId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), wbsItemId));
    }

    private List<WbsItem> orderAsTree(List<WbsItem> items) {
        final Map<Long, List<WbsItem>> childrenByParentId = new HashMap<>();
        final var roots = new ArrayList<WbsItem>();

        for (final var item : items) {
            final var parent = item.getParent();
            if (parent == null) {
                roots.add(item);
                continue;
            }
            childrenByParentId.computeIfAbsent(parent.getId(), (key) -> new ArrayList<>()).add(item);
        }

        final Comparator<WbsItem> comparator = Comparator.comparingInt(WbsItem::getSortOrder).thenComparing(
            WbsItem::getId
        );
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
            if (children == null || children.isEmpty()) {
                continue;
            }
            for (int i = children.size() - 1; i >= 0; i--) {
                stack.push(children.get(i));
            }
        }

        return ordered;
    }

    private int computeDepth(
        Long itemId,
        Map<Long, WbsItem> itemMap,
        Map<Long, WbsReorderCommand> commandMap,
        Map<Long, Integer> depthMemo,
        Set<Long> visiting
    ) {
        final var cached = depthMemo.get(itemId);
        if (cached != null) {
            return cached;
        }

        if (!visiting.add(itemId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
        }

        final var command = commandMap.get(itemId);
        final Long parentId;
        if (command != null) {
            parentId = command.parentId();
        } else {
            final var parent = itemMap.get(itemId).getParent();
            parentId = parent == null ? null : parent.getId();
        }

        final int depth;
        if (parentId == null) {
            depth = 0;
        } else {
            if (!itemMap.containsKey(parentId)) {
                throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), parentId);
            }
            depth = computeDepth(parentId, itemMap, commandMap, depthMemo, visiting) + 1;
        }

        visiting.remove(itemId);

        if (depth > WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }

        depthMemo.put(itemId, depth);
        return depth;
    }

    private WbsItemResult toResult(WbsItem item) {
        return toResult(item, List.of(), List.of());
    }

    private WbsItemResult toResult(WbsItem item, List<Long> predecessorIds, List<Long> successorIds) {
        final var assignee = item.getAssignee();
        final var milestone = item.getMilestone();
        final var scheduleMetrics = wbsScheduleMetricsService.calculate(
            item.getStartDate(),
            item.getEndDate(),
            item.getActualStartDate(),
            item.getActualEndDate(),
            item.getProgressRate()
        );
        return new WbsItemResult(
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

    /**
     * WBS 항목 생성 커맨드.
     *
     * @param parentId       부모 항목 ID
     * @param name           항목명
     * @param assigneeUserId 담당자 사용자 ID
     * @param startDate      시작일
     * @param endDate        종료일
     * @param progressRate   진척률
     * @param estimatedMm    예상 M/M
     * @param milestoneId    마일스톤 ID
     */
    public record CreateWbsItemCommand(
        @Nullable Long parentId,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId
    ) {}

    /**
     * WBS 재정렬 커맨드.
     *
     * @param id        WBS 항목 ID
     * @param parentId  변경 부모 ID
     * @param sortOrder 변경 정렬 순서
     */
    public record WbsReorderCommand(Long id, @Nullable Long parentId, int sortOrder) {}

    /**
     * WBS 항목 조회 결과.
     *
     * @param id             항목 ID
     * @param parentId       부모 항목 ID
     * @param name           항목명
     * @param depth          트리 깊이 (0~8)
     * @param sortOrder      정렬 순서
     * @param assigneeUserId 담당자 사용자 ID
     * @param assigneeName   담당자 이름
     * @param startDate      시작일
     * @param endDate        종료일
     * @param progressRate   진척률
     * @param estimatedMm    예상 M/M
     * @param milestoneId    마일스톤 ID
     * @param milestoneName  마일스톤 이름
     * @param predecessorIds 선행 WBS ID 목록
     * @param successorIds   후행 WBS ID 목록
     * @param createdAt      생성 시각
     * @param updatedAt      수정 시각
     */
    public record WbsItemResult(
        Long id,
        @Nullable Long parentId,
        String name,
        int depth,
        int sortOrder,
        @Nullable Long assigneeUserId,
        @Nullable String assigneeName,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        int progressRate,
        @Nullable Integer plannedProgressRate,
        @Nullable Integer progressVarianceRate,
        @Nullable Integer startVarianceDays,
        @Nullable Integer endVarianceDays,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId,
        @Nullable String milestoneName,
        List<Long> predecessorIds,
        List<Long> successorIds,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
