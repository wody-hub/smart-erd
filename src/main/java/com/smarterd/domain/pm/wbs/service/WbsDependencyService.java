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
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
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

    /**
     * WBS dependency 생성/수정 커맨드.
     *
     * @param predecessorWbsItemId 선행 WBS 항목 ID
     * @param successorWbsItemId 후행 WBS 항목 ID
     * @param dependencyType dependency 타입
     */
    public record WbsDependencyCommand(Long predecessorWbsItemId, Long successorWbsItemId, WbsDependencyType dependencyType) {}

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
}
