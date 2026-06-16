package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * WBS template/subtree payload를 실제 WBS item/dependency로 생성한다.
 */
final class WbsPlanningInstantiationSupport {

    private final WbsDependencyRepository wbsDependencyRepository;
    private final WbsPlanningItemFactory itemFactory;
    private final WbsPlanningResultMapper resultMapper;

    /**
     * @param wbsDependencyRepository WBS dependency 레포지토리
     * @param itemFactory WBS item 생성 객체
     * @param resultMapper 결과 매퍼
     */
    WbsPlanningInstantiationSupport(
        WbsDependencyRepository wbsDependencyRepository,
        WbsPlanningItemFactory itemFactory,
        WbsPlanningResultMapper resultMapper
    ) {
        this.wbsDependencyRepository = wbsDependencyRepository;
        this.itemFactory = itemFactory;
        this.resultMapper = resultMapper;
    }

    /**
     * template payload를 프로젝트 WBS로 생성한다.
     *
     * @param team 팀
     * @param project 프로젝트
     * @param payload template payload
     * @param command 인스턴스화 명령
     * @return 생성 결과
     */
    WbsPlanningService.WbsMutationResult instantiateSnapshot(
        Team team,
        Project project,
        WbsPlanningService.TemplatePayload payload,
        WbsPlanningService.InstantiateTemplateCommand command
    ) {
        final var targetParent = itemFactory.resolveParent(project, command.parentId());
        final Map<String, WbsItem> createdByStableKey = new LinkedHashMap<>();
        final Map<WbsParentRef, Integer> nextSortOrderByParent = new HashMap<>();
        final var createdItems = new ArrayList<WbsItem>();

        for (final var node : orderedNodes(payload)) {
            final var actualParent = resolveActualParent(node, targetParent, createdByStableKey);
            final var created = itemFactory.createItem(
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

        final var createdDependencies = command.includeDependencies()
            ? createDependencies(project, payload, createdByStableKey)
            : List.<WbsDependency>of();
        return toMutationResult(createdItems, createdDependencies);
    }

    /**
     * payload node를 생성 순서로 정렬한다.
     *
     * @param payload template payload
     * @return 정렬된 node 목록
     */
    private List<WbsPlanningService.TemplateNodePayload> orderedNodes(WbsPlanningService.TemplatePayload payload) {
        return payload
            .nodes()
            .stream()
            .sorted(java.util.Comparator.comparingInt(WbsPlanningService.TemplateNodePayload::order))
            .toList();
    }

    /**
     * 실제 parent WBS를 해석한다.
     *
     * @param node node payload
     * @param targetParent 요청 parent
     * @param createdByStableKey stable key별 생성 item
     * @return 실제 parent WBS
     */
    private WbsItem resolveActualParent(
        WbsPlanningService.TemplateNodePayload node,
        WbsItem targetParent,
        Map<String, WbsItem> createdByStableKey
    ) {
        final var actualParent =
            node.parentStableKey() == null ? targetParent : createdByStableKey.get(node.parentStableKey());
        if (node.parentStableKey() != null && actualParent == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
        }
        return actualParent;
    }

    /**
     * template payload dependency를 생성한다.
     *
     * @param project 프로젝트
     * @param payload template payload
     * @param createdByStableKey stable key별 생성 item
     * @return 생성된 dependency 목록
     */
    private List<WbsDependency> createDependencies(
        Project project,
        WbsPlanningService.TemplatePayload payload,
        Map<String, WbsItem> createdByStableKey
    ) {
        final var createdDependencies = new ArrayList<WbsDependency>();
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
        return createdDependencies;
    }

    /**
     * 생성 item/dependency를 mutation 결과로 변환한다.
     *
     * @param createdItems 생성된 item 목록
     * @param createdDependencies 생성된 dependency 목록
     * @return mutation 결과
     */
    private WbsPlanningService.WbsMutationResult toMutationResult(
        List<WbsItem> createdItems,
        List<WbsDependency> createdDependencies
    ) {
        final var predecessorIdsByItemId = new HashMap<Long, List<Long>>();
        final var successorIdsByItemId = new HashMap<Long, List<Long>>();
        for (final var dependency : createdDependencies) {
            predecessorIdsByItemId
                .computeIfAbsent(dependency.getSuccessor().getId(), (ignored) -> new ArrayList<>())
                .add(dependency.getPredecessor().getId());
            successorIdsByItemId
                .computeIfAbsent(dependency.getPredecessor().getId(), (ignored) -> new ArrayList<>())
                .add(dependency.getSuccessor().getId());
        }

        return new WbsPlanningService.WbsMutationResult(
            createdItems.getFirst().getId(),
            createdItems
                .stream()
                .map((item) ->
                    resultMapper.toItemResult(
                        item,
                        predecessorIdsByItemId.getOrDefault(item.getId(), List.of()),
                        successorIdsByItemId.getOrDefault(item.getId(), List.of())
                    )
                )
                .toList(),
            createdDependencies.stream().map(resultMapper::toDependencyResult).toList()
        );
    }
}
