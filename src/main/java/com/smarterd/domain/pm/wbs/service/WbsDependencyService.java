package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.wbs.entity.WbsDependency;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
 * WBS 선후행 관계 관리 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WbsDependencyService {

    private final WbsDependencyRepository wbsDependencyRepository;
    private final WbsItemRepository wbsItemRepository;
    private final ProjectContextLoader projectContextLoader;

    /**
     * 프로젝트의 WBS dependency 목록을 조회한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @return dependency 결과 목록
     */
    public List<WbsDependencyResult> getDependencies(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return wbsDependencyRepository
            .findByProjectWithRelations(context.project())
            .stream()
            .map(this::toResult)
            .toList();
    }

    /**
     * WBS dependency를 생성한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param command 생성 커맨드
     * @return 생성된 dependency 결과
     */
    @Transactional
    public WbsDependencyResult createDependency(String loginId, Long teamId, Long projectId, WbsDependencyCommand command) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var predecessor = findWbsItem(context.project(), command.predecessorWbsItemId());
        final var successor = findWbsItem(context.project(), command.successorWbsItemId());

        validateDependency(context.project(), predecessor, successor, command.dependencyType(), null);

        final var dependency = Objects.requireNonNull(
            WbsDependency.builder()
                .project(context.project())
                .predecessor(predecessor)
                .successor(successor)
                .dependencyType(command.dependencyType())
                .sortOrder(wbsDependencyRepository.findNextSortOrder(context.project()))
                .build()
        );
        wbsDependencyRepository.save(dependency);
        return toResult(dependency);
    }

    /**
     * WBS dependency를 수정한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param dependencyId 수정 대상 dependency ID
     * @param command 수정 커맨드
     * @return 수정된 dependency 결과
     */
    @Transactional
    public WbsDependencyResult updateDependency(
        String loginId,
        Long teamId,
        Long projectId,
        Long dependencyId,
        WbsDependencyCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var dependency = findDependency(context.project(), dependencyId);
        final var predecessor = findWbsItem(context.project(), command.predecessorWbsItemId());
        final var successor = findWbsItem(context.project(), command.successorWbsItemId());

        validateDependency(context.project(), predecessor, successor, command.dependencyType(), dependency.getId());

        dependency.update(predecessor, successor, command.dependencyType());
        return toResult(dependency);
    }

    /**
     * WBS dependency를 삭제한다.
     *
     * @param loginId 로그인 사용자 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param dependencyId 삭제 대상 dependency ID
     */
    @Transactional
    public void deleteDependency(String loginId, Long teamId, Long projectId, Long dependencyId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var dependency = findDependency(context.project(), dependencyId);
        wbsDependencyRepository.delete(dependency);
    }

    public WbsDependencyShiftResult previewShift(
        String loginId,
        Long teamId,
        Long projectId,
        List<WbsDependencyShiftAnchorCommand> anchors
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return computeShift(context.project(), anchors, false);
    }

    @Transactional
    public WbsDependencyShiftResult applyShift(
        String loginId,
        Long teamId,
        Long projectId,
        List<WbsDependencyShiftAnchorCommand> anchors
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        return computeShift(context.project(), anchors, true);
    }

    private void validateDependency(
        Project project,
        WbsItem predecessor,
        WbsItem successor,
        WbsDependencyType dependencyType,
        Long excludedDependencyId
    ) {
        if (Objects.equals(predecessor.getId(), successor.getId())) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPENDENCY_SELF_REFERENCE.code());
        }

        if (hasDuplicate(project, predecessor, successor, dependencyType, excludedDependencyId)) {
            throw new DuplicateException(
                MessageCode.ERROR_DUPLICATE_WBS_DEPENDENCY.code(),
                predecessor.getId(),
                successor.getId(),
                dependencyType
            );
        }

        if (createsCycle(project, predecessor.getId(), successor.getId(), excludedDependencyId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPENDENCY_CYCLE.code());
        }
    }

    private boolean hasDuplicate(
        Project project,
        WbsItem predecessor,
        WbsItem successor,
        WbsDependencyType dependencyType,
        Long excludedDependencyId
    ) {
        if (excludedDependencyId == null) {
            return wbsDependencyRepository.existsByProjectAndPredecessorAndSuccessorAndDependencyType(
                project,
                predecessor,
                successor,
                dependencyType
            );
        }

        return wbsDependencyRepository
            .findByProjectWithRelations(project)
            .stream()
            .filter((dependency) -> !Objects.equals(dependency.getId(), excludedDependencyId))
            .anyMatch((dependency) ->
                Objects.equals(dependency.getPredecessor().getId(), predecessor.getId()) &&
                Objects.equals(dependency.getSuccessor().getId(), successor.getId()) &&
                dependency.getDependencyType() == dependencyType
            );
    }

    private boolean createsCycle(Project project, Long predecessorId, Long successorId, Long excludedDependencyId) {
        final Map<Long, List<Long>> outgoing = new HashMap<>();
        for (final var dependency : wbsDependencyRepository.findByProjectWithRelations(project)) {
            if (Objects.equals(dependency.getId(), excludedDependencyId)) {
                continue;
            }
            outgoing
                .computeIfAbsent(dependency.getPredecessor().getId(), (ignored) -> new ArrayList<>())
                .add(dependency.getSuccessor().getId());
        }
        outgoing.computeIfAbsent(predecessorId, (ignored) -> new ArrayList<>()).add(successorId);

        final var queue = new ArrayDeque<Long>();
        final var visited = new java.util.HashSet<Long>();
        queue.add(successorId);

        while (!queue.isEmpty()) {
            final var current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            if (Objects.equals(current, predecessorId)) {
                return true;
            }
            for (final var next : outgoing.getOrDefault(current, List.of())) {
                queue.addLast(next);
            }
        }
        return false;
    }

    private WbsItem findWbsItem(Project project, Long wbsItemId) {
        return wbsItemRepository
            .findByProjectAndId(project, wbsItemId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), wbsItemId));
    }

    private WbsDependency findDependency(Project project, Long dependencyId) {
        return wbsDependencyRepository
            .findByProjectAndId(project, dependencyId)
            .orElseThrow(
                () -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_DEPENDENCY.code(), dependencyId)
            );
    }

    private WbsDependencyResult toResult(WbsDependency dependency) {
        return new WbsDependencyResult(
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

    private WbsDependencyShiftResult computeShift(
        Project project,
        List<WbsDependencyShiftAnchorCommand> anchors,
        boolean apply
    ) {
        final var items = wbsItemRepository.findByProjectWithRelations(project);
        final var itemById = new LinkedHashMap<Long, WbsItem>();
        items.forEach((item) -> itemById.put(item.getId(), item));
        final var dependencies = wbsDependencyRepository
            .findByProjectWithRelations(project)
            .stream()
            .sorted(Comparator.comparingInt(WbsDependency::getSortOrder).thenComparing(WbsDependency::getId))
            .toList();

        final Map<Long, DateRange> originalRanges = new LinkedHashMap<>();
        final Map<Long, DateRange> workingRanges = new LinkedHashMap<>();
        for (final var item : items) {
            final var range = toRange(item.getStartDate(), item.getEndDate());
            if (range != null) {
                originalRanges.put(item.getId(), range);
                workingRanges.put(item.getId(), range);
            }
        }

        final var issues = new ArrayList<WbsDependencyShiftIssueResult>();
        final Set<Long> anchorIds = new java.util.LinkedHashSet<>();
        for (final var anchor : anchors) {
            final var item = itemById.get(anchor.wbsItemId());
            if (item == null) {
                throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), anchor.wbsItemId());
            }
            if (anchor.startDate().isAfter(anchor.endDate())) {
                throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_WBS_PERIOD.code());
            }
            workingRanges.put(anchor.wbsItemId(), new DateRange(anchor.startDate(), anchor.endDate()));
            anchorIds.add(anchor.wbsItemId());
        }

        boolean changed;
        do {
            changed = false;
            for (final var dependency : dependencies) {
                final var predecessorId = dependency.getPredecessor().getId();
                final var successorId = dependency.getSuccessor().getId();
                final var predecessorRange = workingRanges.get(predecessorId);
                final var successorRange = workingRanges.get(successorId);
                if (predecessorRange == null) {
                    issues.add(new WbsDependencyShiftIssueResult(predecessorId, "missing-date", "선행 WBS 일정이 비어 있어 canonical shift를 계산할 수 없습니다."));
                    continue;
                }
                if (successorRange == null) {
                    issues.add(new WbsDependencyShiftIssueResult(successorId, "missing-date", "후행 WBS 일정이 비어 있어 canonical shift를 계산할 수 없습니다."));
                    continue;
                }
                final var shifted = shiftSuccessorIfNeeded(predecessorRange, successorRange, dependency.getDependencyType());
                if (shifted != null && !shifted.equals(successorRange)) {
                    workingRanges.put(successorId, shifted);
                    changed = true;
                }
            }
        } while (changed);

        final var distinctIssues = issues.stream().distinct().toList();
        final var updates = new ArrayList<WbsDependencyShiftItemResult>();
        final var changedItems = new ArrayList<WbsItem>();
        for (final var item : items) {
            final var original = originalRanges.get(item.getId());
            final var current = workingRanges.get(item.getId());
            if (original == null || current == null || original.equals(current)) {
                continue;
            }
            updates.add(
                new WbsDependencyShiftItemResult(
                    item.getId(),
                    original.startDate(),
                    original.endDate(),
                    current.startDate(),
                    current.endDate(),
                    anchorIds.contains(item.getId())
                )
            );
            if (apply && distinctIssues.isEmpty()) {
                item.update(
                    item.getName(),
                    item.getAssignee(),
                    current.startDate(),
                    current.endDate(),
                    item.getActualStartDate(),
                    item.getActualEndDate(),
                    item.getProgressRate(),
                    item.getEstimatedMm(),
                    item.getMilestone()
                );
                changedItems.add(item);
            }
        }
        if (apply && !changedItems.isEmpty() && distinctIssues.isEmpty()) {
            wbsItemRepository.saveAll(changedItems);
        }

        return new WbsDependencyShiftResult(distinctIssues.isEmpty(), apply && distinctIssues.isEmpty(), List.copyOf(updates), distinctIssues);
    }

    @Nullable
    private DateRange shiftSuccessorIfNeeded(DateRange predecessorRange, DateRange successorRange, WbsDependencyType dependencyType) {
        final long durationDays = ChronoUnit.DAYS.between(successorRange.startDate(), successorRange.endDate());
        return switch (dependencyType) {
            case SS -> {
                if (!successorRange.startDate().isBefore(predecessorRange.startDate())) {
                    yield null;
                }
                final var nextStart = predecessorRange.startDate();
                yield new DateRange(nextStart, nextStart.plusDays(durationDays));
            }
            case FF -> {
                if (!successorRange.endDate().isBefore(predecessorRange.endDate())) {
                    yield null;
                }
                final var nextEnd = predecessorRange.endDate();
                yield new DateRange(nextEnd.minusDays(durationDays), nextEnd);
            }
            case SF -> {
                if (!successorRange.endDate().isBefore(predecessorRange.startDate())) {
                    yield null;
                }
                final var nextEnd = predecessorRange.startDate();
                yield new DateRange(nextEnd.minusDays(durationDays), nextEnd);
            }
            case FS -> {
                if (!successorRange.startDate().isBefore(predecessorRange.endDate())) {
                    yield null;
                }
                final var nextStart = predecessorRange.endDate();
                yield new DateRange(nextStart, nextStart.plusDays(durationDays));
            }
        };
    }

    @Nullable
    private DateRange toRange(@Nullable LocalDate startDate, @Nullable LocalDate endDate) {
        if (startDate == null || endDate == null) {
            return null;
        }
        return new DateRange(startDate, endDate);
    }

    /**
     * WBS dependency 생성/수정 커맨드.
     *
     * @param predecessorWbsItemId 선행 WBS 항목 ID
     * @param successorWbsItemId 후행 WBS 항목 ID
     * @param dependencyType dependency 타입
     */
    public record WbsDependencyCommand(Long predecessorWbsItemId, Long successorWbsItemId, WbsDependencyType dependencyType) {}

    public record WbsDependencyShiftAnchorCommand(Long wbsItemId, LocalDate startDate, LocalDate endDate) {}

    /**
     * WBS dependency 조회 결과.
     *
     * @param id dependency ID
     * @param predecessorWbsItemId 선행 WBS 항목 ID
     * @param predecessorWbsItemName 선행 WBS 항목 이름
     * @param successorWbsItemId 후행 WBS 항목 ID
     * @param successorWbsItemName 후행 WBS 항목 이름
     * @param dependencyType dependency 타입
     * @param sortOrder 정렬 순서
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record WbsDependencyResult(
        Long id,
        Long predecessorWbsItemId,
        String predecessorWbsItemName,
        Long successorWbsItemId,
        String successorWbsItemName,
        WbsDependencyType dependencyType,
        int sortOrder,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record WbsDependencyShiftResult(
        boolean graphValid,
        boolean applied,
        List<WbsDependencyShiftItemResult> updates,
        List<WbsDependencyShiftIssueResult> issues
    ) {}

    public record WbsDependencyShiftItemResult(
        Long wbsItemId,
        LocalDate originalStartDate,
        LocalDate originalEndDate,
        LocalDate startDate,
        LocalDate endDate,
        boolean anchor
    ) {}

    public record WbsDependencyShiftIssueResult(@Nullable Long wbsItemId, String code, String message) {}

    private record DateRange(LocalDate startDate, LocalDate endDate) {}
}
