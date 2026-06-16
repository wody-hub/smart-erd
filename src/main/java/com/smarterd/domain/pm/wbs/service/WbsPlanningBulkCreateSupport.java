package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * WBS item 대량 생성 orchestration을 담당한다.
 */
final class WbsPlanningBulkCreateSupport {

    private final WbsPlanningItemFactory itemFactory;
    private final WbsPlanningResultMapper resultMapper;

    /**
     * @param itemFactory WBS item 생성 객체
     * @param resultMapper 결과 매퍼
     */
    WbsPlanningBulkCreateSupport(WbsPlanningItemFactory itemFactory, WbsPlanningResultMapper resultMapper) {
        this.itemFactory = itemFactory;
        this.resultMapper = resultMapper;
    }

    /**
     * WBS item을 대량 생성한다.
     *
     * @param team 팀
     * @param project 프로젝트
     * @param command 대량 생성 명령
     * @return 대량 생성 결과
     */
    WbsPlanningService.BulkCreateResult bulkCreate(
        Team team,
        Project project,
        WbsPlanningService.BulkCreateCommand command
    ) {
        validateBulkCreateItems(command.items());

        final var unresolved = new LinkedHashMap<String, WbsPlanningService.BulkCreateItemCommand>();
        for (final var item : command.items()) {
            unresolved.put(item.clientKey(), item);
        }

        final Map<String, WbsItem> createdByClientKey = new LinkedHashMap<>();
        final Map<WbsParentRef, Integer> nextSortOrderByParent = new HashMap<>();
        final var createdResults = new ArrayList<WbsPlanningService.BulkCreateItemResult>();

        while (!unresolved.isEmpty()) {
            if (
                !createProgressedItems(
                    team,
                    project,
                    unresolved,
                    createdByClientKey,
                    nextSortOrderByParent,
                    createdResults
                )
            ) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_REORDER_INVALID.code());
            }
        }

        return new WbsPlanningService.BulkCreateResult(List.copyOf(createdResults));
    }

    /**
     * 생성 가능한 item들을 한 차례 생성한다.
     *
     * @param team 팀
     * @param project 프로젝트
     * @param unresolved 미해결 item 명령
     * @param createdByClientKey client key별 생성 item
     * @param nextSortOrderByParent parent별 다음 sort order
     * @param createdResults 생성 결과 누적 목록
     * @return 하나라도 생성했으면 true
     */
    private boolean createProgressedItems(
        Team team,
        Project project,
        Map<String, WbsPlanningService.BulkCreateItemCommand> unresolved,
        Map<String, WbsItem> createdByClientKey,
        Map<WbsParentRef, Integer> nextSortOrderByParent,
        List<WbsPlanningService.BulkCreateItemResult> createdResults
    ) {
        boolean progressed = false;
        for (final var entry : List.copyOf(unresolved.entrySet())) {
            final var item = entry.getValue();
            final var parent = resolveBulkParent(project, item, createdByClientKey);
            if (item.parentClientKey() != null && parent == null) {
                continue;
            }

            final var created = itemFactory.createItem(
                team,
                project,
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
            createdResults.add(
                new WbsPlanningService.BulkCreateItemResult(item.clientKey(), resultMapper.toItemResult(created))
            );
            unresolved.remove(entry.getKey());
            progressed = true;
        }
        return progressed;
    }

    /**
     * bulk create parent를 해석한다.
     *
     * @param project 프로젝트
     * @param item item 명령
     * @param createdByClientKey client key별 생성 item
     * @return parent WBS
     */
    private WbsItem resolveBulkParent(
        Project project,
        WbsPlanningService.BulkCreateItemCommand item,
        Map<String, WbsItem> createdByClientKey
    ) {
        if (item.parentClientKey() != null) {
            return createdByClientKey.get(item.parentClientKey());
        }
        return itemFactory.resolveParent(project, item.parentId());
    }

    /**
     * bulk create 명령 목록을 검증한다.
     *
     * @param items item 명령 목록
     */
    private void validateBulkCreateItems(List<WbsPlanningService.BulkCreateItemCommand> items) {
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
}
