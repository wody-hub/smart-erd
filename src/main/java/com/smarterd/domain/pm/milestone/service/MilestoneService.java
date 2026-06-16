package com.smarterd.domain.pm.milestone.service;

import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.entity.MilestoneType;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepositoryCustom.MilestoneProgressAggregate;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 마일스톤 관리 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final WbsDependencyRepository wbsDependencyRepository;
    private final WbsItemRepository wbsItemRepository;
    private final ProjectContextLoader projectContextLoader;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    /**
     * 프로젝트의 마일스톤을 조회한다. 연결 WBS 진척률과 지연 여부를 함께 계산한다.
     *
     * @param loginId   로그인 사용자 ID
     * @param teamId    팀 ID
     * @param projectId 프로젝트 ID
     * @return 마일스톤 결과 목록
     */
    public List<MilestoneResult> getMilestones(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);

        final var milestones = milestoneRepository.findByProjectOrderBySortOrder(context.project());
        final var dependencyCounts = aggregateDependencyCounts(context.project());
        final var aggregates = wbsItemRepository.aggregateProgressByMilestone(context.project());

        final var today = LocalDate.now(clock);
        final var nextWaveMilestoneId = resolveNextWaveMilestoneId(milestones, aggregates);
        return milestones
            .stream()
            .map((milestone) -> {
                final var aggregate = aggregates.getOrDefault(milestone.getId(), MilestoneProgressAggregate.EMPTY);
                final var dependencyCount = dependencyCounts.getOrDefault(
                    milestone.getId(),
                    MilestoneDependencyCount.EMPTY
                );
                final var isDelayed = milestone.getTargetDate().isBefore(today) && aggregate.averageRate() < 100;
                return toResult(
                    milestone,
                    aggregate,
                    isDelayed,
                    dependencyCount.inboundCount(),
                    dependencyCount.outboundCount(),
                    Objects.equals(milestone.getId(), nextWaveMilestoneId) ? aggregate.count() : 0L
                );
            })
            .toList();
    }

    /**
     * 마일스톤을 생성한다.
     *
     * @param loginId     로그인 사용자 ID
     * @param teamId      팀 ID
     * @param projectId   프로젝트 ID
     * @param name        마일스톤명
     * @param targetDate  목표일
     * @param description 설명
     * @param type        마일스톤 유형
     * @param ownerUserId 담당자 사용자 ID
     * @param readinessNote 게이트 준비 메모
     * @return 생성된 마일스톤 결과
     */
    @Transactional
    public MilestoneResult createMilestone(
        String loginId,
        Long teamId,
        Long projectId,
        String name,
        LocalDate targetDate,
        @Nullable String description,
        MilestoneType type,
        @Nullable Long ownerUserId,
        @Nullable String readinessNote
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var sortOrder = milestoneRepository.findNextSortOrder(context.project());
        final var owner = resolveOwner(context.team(), ownerUserId);

        final var milestone = Objects.requireNonNull(
            Milestone.builder()
                .project(context.project())
                .name(name)
                .targetDate(targetDate)
                .description(description)
                .type(type)
                .owner(owner)
                .readinessNote(readinessNote)
                .sortOrder(sortOrder)
                .build()
        );

        milestoneRepository.save(milestone);
        return toResult(milestone, MilestoneProgressAggregate.EMPTY, false, 0L, 0L, 0L);
    }

    /**
     * 마일스톤을 수정한다.
     *
     * @param loginId     로그인 사용자 ID
     * @param teamId      팀 ID
     * @param projectId   프로젝트 ID
     * @param milestoneId 수정 대상 마일스톤 ID
     * @param name        마일스톤명
     * @param targetDate  목표일
     * @param description 설명
     * @param type        마일스톤 유형
     * @param ownerUserId 담당자 사용자 ID
     * @param readinessNote 게이트 준비 메모
     * @return 수정된 마일스톤 결과
     */
    @Transactional
    public MilestoneResult updateMilestone(
        String loginId,
        Long teamId,
        Long projectId,
        Long milestoneId,
        String name,
        LocalDate targetDate,
        @Nullable String description,
        MilestoneType type,
        @Nullable Long ownerUserId,
        @Nullable String readinessNote
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var milestone = findByProjectAndId(context.project(), milestoneId);
        final var owner = resolveOwner(context.team(), ownerUserId);

        milestone.update(name, targetDate, description, type, owner, readinessNote);

        final var aggregate = wbsItemRepository.aggregateProgressByMilestone(milestone);
        final var dependencyCount = aggregateDependencyCounts(context.project()).getOrDefault(
            milestone.getId(),
            MilestoneDependencyCount.EMPTY
        );
        final var isDelayed = milestone.getTargetDate().isBefore(LocalDate.now(clock)) && aggregate.averageRate() < 100;
        return toResult(
            milestone,
            aggregate,
            isDelayed,
            dependencyCount.inboundCount(),
            dependencyCount.outboundCount(),
            0L
        );
    }

    /**
     * 마일스톤을 삭제한다. 연결 WBS 참조를 먼저 제거한다.
     *
     * @param loginId     로그인 사용자 ID
     * @param teamId      팀 ID
     * @param projectId   프로젝트 ID
     * @param milestoneId 삭제 대상 마일스톤 ID
     */
    @Transactional
    public void deleteMilestone(String loginId, Long teamId, Long projectId, Long milestoneId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var milestone = findByProjectAndId(context.project(), milestoneId);
        wbsItemRepository.clearMilestoneReferences(milestone);
        milestoneRepository.delete(milestone);
    }

    private Milestone findByProjectAndId(Project project, Long milestoneId) {
        return milestoneRepository
            .findByProjectAndId(project, Objects.requireNonNull(milestoneId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_MILESTONE.code(), milestoneId));
    }

    @Nullable
    private Long resolveNextWaveMilestoneId(
        List<Milestone> milestones,
        Map<Long, MilestoneProgressAggregate> aggregates
    ) {
        return milestones
            .stream()
            .filter(
                (milestone) -> aggregates.getOrDefault(milestone.getId(), MilestoneProgressAggregate.EMPTY).count() > 0
            )
            .filter(
                (milestone) ->
                    aggregates.getOrDefault(milestone.getId(), MilestoneProgressAggregate.EMPTY).averageRate() < 100
            )
            .sorted((left, right) -> {
                final var compareDate = left.getTargetDate().compareTo(right.getTargetDate());
                if (compareDate != 0) {
                    return compareDate;
                }
                final var compareSortOrder = Integer.compare(left.getSortOrder(), right.getSortOrder());
                if (compareSortOrder != 0) {
                    return compareSortOrder;
                }
                return Long.compare(left.getId(), right.getId());
            })
            .map(Milestone::getId)
            .findFirst()
            .orElse(null);
    }

    private Map<Long, MilestoneDependencyCount> aggregateDependencyCounts(Project project) {
        final Map<Long, MilestoneDependencyCount> counts = new java.util.HashMap<>();
        for (final var dependency : wbsDependencyRepository.findByProjectWithRelations(project)) {
            final var predecessorMilestone = dependency.getPredecessor().getMilestone();
            final var successorMilestone = dependency.getSuccessor().getMilestone();

            if (
                predecessorMilestone != null &&
                (successorMilestone == null ||
                    !Objects.equals(predecessorMilestone.getId(), successorMilestone.getId()))
            ) {
                counts.compute(predecessorMilestone.getId(), (ignored, current) ->
                    (current == null ? MilestoneDependencyCount.EMPTY : current).incrementOutbound()
                );
            }

            if (
                successorMilestone != null &&
                (predecessorMilestone == null ||
                    !Objects.equals(successorMilestone.getId(), predecessorMilestone.getId()))
            ) {
                counts.compute(successorMilestone.getId(), (ignored, current) ->
                    (current == null ? MilestoneDependencyCount.EMPTY : current).incrementInbound()
                );
            }
        }
        return counts;
    }

    @Nullable
    private User resolveOwner(Team team, @Nullable Long ownerUserId) {
        if (ownerUserId == null) {
            return null;
        }

        final var owner = userRepository
            .findById(ownerUserId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), ownerUserId));
        if (!teamMemberRepository.existsByTeamAndUser(team, owner)) {
            throw new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), ownerUserId);
        }
        return owner;
    }

    private MilestoneResult toResult(
        Milestone milestone,
        MilestoneProgressAggregate aggregate,
        boolean isDelayed,
        long inboundDependencyCount,
        long outboundDependencyCount,
        long nextWaveWbsCount
    ) {
        final var owner = milestone.getOwner();
        return new MilestoneResult(
            milestone.getId(),
            milestone.getProject().getId(),
            milestone.getName(),
            milestone.getTargetDate(),
            milestone.getDescription(),
            milestone.getType(),
            owner == null ? null : owner.getId(),
            owner == null ? null : owner.getName(),
            milestone.getReadinessNote(),
            milestone.getSortOrder(),
            aggregate.count(),
            aggregate.completedCount(),
            aggregate.averageRate(),
            inboundDependencyCount,
            outboundDependencyCount,
            nextWaveWbsCount,
            isDelayed,
            milestone.getCreatedAt(),
            milestone.getUpdatedAt()
        );
    }

    /**
     * 마일스톤 조회 결과.
     *
     * @param id                 마일스톤 ID
     * @param projectId          프로젝트 ID
     * @param name               마일스톤명
     * @param targetDate         목표일
     * @param description        설명
     * @param type               마일스톤 유형
     * @param ownerUserId        담당자 사용자 ID
     * @param ownerName          담당자 이름
     * @param readinessNote      게이트 준비 메모
     * @param sortOrder          정렬 순서
     * @param linkedWbsItemCount 연결 WBS 항목 수
     * @param linkedWbsCompletedCount 완료된 연결 WBS 항목 수
     * @param achievementRate    달성률
     * @param inboundDependencyCount 유입 dependency 수
     * @param outboundDependencyCount 유출 dependency 수
     * @param nextWaveWbsCount   다음 wave WBS 항목 수
     * @param isDelayed          지연 여부
     * @param createdAt          생성 시각
     * @param updatedAt          수정 시각
     */
    public record MilestoneResult(
        Long id,
        Long projectId,
        String name,
        LocalDate targetDate,
        @Nullable String description,
        MilestoneType type,
        @Nullable Long ownerUserId,
        @Nullable String ownerName,
        @Nullable String readinessNote,
        int sortOrder,
        long linkedWbsItemCount,
        long linkedWbsCompletedCount,
        int achievementRate,
        long inboundDependencyCount,
        long outboundDependencyCount,
        long nextWaveWbsCount,
        boolean isDelayed,
        Instant createdAt,
        Instant updatedAt
    ) {}

    private record MilestoneDependencyCount(long inboundCount, long outboundCount) {
        private static final MilestoneDependencyCount EMPTY = new MilestoneDependencyCount(0L, 0L);

        private MilestoneDependencyCount incrementInbound() {
            return new MilestoneDependencyCount(inboundCount + 1, outboundCount);
        }

        private MilestoneDependencyCount incrementOutbound() {
            return new MilestoneDependencyCount(inboundCount, outboundCount + 1);
        }
    }
}
