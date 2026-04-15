package com.smarterd.domain.pm.milestone.service;

import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepositoryCustom.MilestoneProgressAggregate;
import com.smarterd.domain.project.entity.Project;
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
    private final WbsItemRepository wbsItemRepository;
    private final ProjectContextLoader projectContextLoader;
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
        final var aggregates = wbsItemRepository.aggregateProgressByMilestone(context.project());

        final var today = LocalDate.now(clock);
        return milestones
            .stream()
            .map((milestone) -> {
                final var aggregate = aggregates.getOrDefault(milestone.getId(), MilestoneProgressAggregate.EMPTY);
                final var isDelayed = milestone.getTargetDate().isBefore(today) && aggregate.averageRate() < 100;
                return toResult(milestone, aggregate.count(), aggregate.averageRate(), isDelayed);
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
     * @return 생성된 마일스톤 결과
     */
    @Transactional
    public MilestoneResult createMilestone(
        String loginId,
        Long teamId,
        Long projectId,
        String name,
        LocalDate targetDate,
        @Nullable String description
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var sortOrder = milestoneRepository.findNextSortOrder(context.project());

        final var milestone = Objects.requireNonNull(
            Milestone.builder()
                .project(context.project())
                .name(name)
                .targetDate(targetDate)
                .description(description)
                .sortOrder(sortOrder)
                .build()
        );

        milestoneRepository.save(milestone);
        return toResult(milestone, 0L, 0, false);
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
        @Nullable String description
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var milestone = findByProjectAndId(context.project(), milestoneId);

        milestone.update(name, targetDate, description);

        final var aggregate = wbsItemRepository.aggregateProgressByMilestone(milestone);
        final var isDelayed = milestone.getTargetDate().isBefore(LocalDate.now(clock)) && aggregate.averageRate() < 100;
        return toResult(milestone, aggregate.count(), aggregate.averageRate(), isDelayed);
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

    private MilestoneResult toResult(Milestone milestone, long linkedCount, int achievementRate, boolean isDelayed) {
        return new MilestoneResult(
            milestone.getId(),
            milestone.getProject().getId(),
            milestone.getName(),
            milestone.getTargetDate(),
            milestone.getDescription(),
            milestone.getSortOrder(),
            linkedCount,
            achievementRate,
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
     * @param sortOrder          정렬 순서
     * @param linkedWbsItemCount 연결 WBS 항목 수
     * @param achievementRate    달성률
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
        int sortOrder,
        long linkedWbsItemCount,
        int achievementRate,
        boolean isDelayed,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
