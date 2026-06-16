package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * WBS subtree를 template payload로 스냅샷화한다.
 */
final class WbsPlanningSnapshotSupport {

    private final WbsItemRepository wbsItemRepository;
    private final WbsDependencyRepository wbsDependencyRepository;

    /**
     * @param wbsItemRepository WBS item 레포지토리
     * @param wbsDependencyRepository WBS dependency 레포지토리
     */
    WbsPlanningSnapshotSupport(WbsItemRepository wbsItemRepository, WbsDependencyRepository wbsDependencyRepository) {
        this.wbsItemRepository = wbsItemRepository;
        this.wbsDependencyRepository = wbsDependencyRepository;
    }

    /**
     * WBS subtree를 template payload로 변환한다.
     *
     * @param project 프로젝트
     * @param sourceWbsItemId 원본 WBS item ID
     * @return template payload
     */
    WbsPlanningService.TemplatePayload snapshotSubtree(Project project, Long sourceWbsItemId) {
        final var allItems = wbsItemRepository.findByProjectWithRelations(project);
        final var itemMap = new LinkedHashMap<Long, WbsItem>();
        allItems.forEach((item) -> itemMap.put(item.getId(), item));
        final var source = itemMap.get(sourceWbsItemId);
        if (source == null) {
            throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), sourceWbsItemId);
        }

        final var descendantIds = collectDescendantIds(source, allItems);
        final var orderedItems = orderAsTree(allItems);
        final var stableKeyByItemId = createStableKeys(orderedItems, descendantIds);
        final var nodes = createNodePayloads(orderedItems, descendantIds, stableKeyByItemId);
        final var dependencies = createDependencyPayloads(project, descendantIds, stableKeyByItemId);
        return new WbsPlanningService.TemplatePayload(source.getName(), nodes, dependencies);
    }

    /**
     * subtree descendant ID를 수집한다.
     *
     * @param root subtree root
     * @param allItems 프로젝트 전체 WBS item
     * @return descendant ID 집합
     */
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

    /**
     * tree 순서로 WBS item을 정렬한다.
     *
     * @param items WBS item 목록
     * @return tree 순서 WBS item 목록
     */
    private List<WbsItem> orderAsTree(List<WbsItem> items) {
        final Map<Long, List<WbsItem>> childrenByParentId = new HashMap<>();
        final var roots = new ArrayList<WbsItem>();
        for (final var item : items) {
            if (item.getParent() == null) {
                roots.add(item);
                continue;
            }
            childrenByParentId.computeIfAbsent(item.getParent().getId(), (ignored) -> new ArrayList<>()).add(item);
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
            if (children == null) {
                continue;
            }
            for (int i = children.size() - 1; i >= 0; i--) {
                stack.push(children.get(i));
            }
        }
        return ordered;
    }

    /**
     * descendant item별 stable key를 생성한다.
     *
     * @param orderedItems tree 순서 WBS item
     * @param descendantIds descendant ID 집합
     * @return item ID별 stable key
     */
    private Map<Long, String> createStableKeys(List<WbsItem> orderedItems, Set<Long> descendantIds) {
        final var stableKeyByItemId = new LinkedHashMap<Long, String>();
        for (final var item : orderedItems) {
            if (descendantIds.contains(item.getId())) {
                stableKeyByItemId.put(item.getId(), "node-" + UUID.randomUUID());
            }
        }
        return stableKeyByItemId;
    }

    /**
     * WBS item payload 목록을 생성한다.
     *
     * @param orderedItems tree 순서 WBS item
     * @param descendantIds descendant ID 집합
     * @param stableKeyByItemId item ID별 stable key
     * @return WBS item payload 목록
     */
    private List<WbsPlanningService.TemplateNodePayload> createNodePayloads(
        List<WbsItem> orderedItems,
        Set<Long> descendantIds,
        Map<Long, String> stableKeyByItemId
    ) {
        final var order = new int[] { 0 };
        final var nodes = new ArrayList<WbsPlanningService.TemplateNodePayload>();
        for (final var item : orderedItems) {
            if (!descendantIds.contains(item.getId())) {
                continue;
            }
            final var parent = item.getParent();
            nodes.add(
                new WbsPlanningService.TemplateNodePayload(
                    stableKeyByItemId.get(item.getId()),
                    parent == null || !descendantIds.contains(parent.getId())
                        ? null
                        : stableKeyByItemId.get(parent.getId()),
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
        return nodes;
    }

    /**
     * subtree 내부 dependency payload 목록을 생성한다.
     *
     * @param project 프로젝트
     * @param descendantIds descendant ID 집합
     * @param stableKeyByItemId item ID별 stable key
     * @return dependency payload 목록
     */
    private List<WbsPlanningService.TemplateDependencyPayload> createDependencyPayloads(
        Project project,
        Set<Long> descendantIds,
        Map<Long, String> stableKeyByItemId
    ) {
        return wbsDependencyRepository
            .findByProjectWithRelations(project)
            .stream()
            .filter(
                (dependency) ->
                    descendantIds.contains(dependency.getPredecessor().getId()) &&
                    descendantIds.contains(dependency.getSuccessor().getId())
            )
            .map((dependency) ->
                new WbsPlanningService.TemplateDependencyPayload(
                    stableKeyByItemId.get(dependency.getPredecessor().getId()),
                    stableKeyByItemId.get(dependency.getSuccessor().getId()),
                    dependency.getDependencyType()
                )
            )
            .toList();
    }
}
