package com.smarterd.domain.pm.staffing.service;

import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.staffing.entity.ProjectStaffing;
import com.smarterd.domain.pm.staffing.entity.StaffingGrade;
import com.smarterd.domain.pm.staffing.repository.ProjectStaffingRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import com.smarterd.utils.AppStringUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 프로젝트 인력 투입 CRUD/집계 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectStaffingService {

    private static final BigDecimal ZERO_MM = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final ProjectStaffingRepository projectStaffingRepository;
    private final ProjectContextLoader projectContextLoader;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final StaffingAllocationCalculator staffingAllocationCalculator;

    public ProjectStaffingListResult getProjectStaffing(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var resources = projectStaffingRepository
            .findByProject(context.project())
            .stream()
            .sorted(
                Comparator.comparing((ProjectStaffing staffing) -> staffing.getUser().getName()).thenComparing(
                    ProjectStaffing::getId
                )
            )
            .map(this::toResourceResult)
            .toList();
        final var summary = toSummary(resources);
        final var months = resources
            .stream()
            .flatMap((resource) ->
                resource.monthlyAllocations().stream().map(ProjectStaffingMonthlyAllocationResult::month)
            )
            .distinct()
            .sorted()
            .toList();

        return new ProjectStaffingListResult(resources, summary, months);
    }

    @Transactional
    public ProjectStaffingResourceResult createProjectStaffing(
        String loginId,
        Long teamId,
        Long projectId,
        CreateProjectStaffingCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var user = resolveUser(command.userId());
        verifyTeamMembership(context.team(), user);

        if (projectStaffingRepository.existsByProjectAndUser(context.project(), user)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code(), user.getLoginId());
        }

        final var staffing = Objects.requireNonNull(
            ProjectStaffing.builder()
                .project(context.project())
                .user(user)
                .grade(command.grade())
                .monthlyRate(command.monthlyRate())
                .plannedStartDate(command.plannedStartDate())
                .plannedEndDate(command.plannedEndDate())
                .plannedParticipationRate(command.plannedParticipationRate())
                .actualStartDate(command.actualStartDate())
                .actualEndDate(command.actualEndDate())
                .actualParticipationRate(command.actualParticipationRate())
                .build()
        );

        final ProjectStaffing saved;
        try {
            saved = projectStaffingRepository.save(staffing);
        } catch (DataIntegrityViolationException ex) {
            if (isProjectMemberUniqueConstraintViolation(ex)) {
                throw new DuplicateException(
                    MessageCode.ERROR_DUPLICATE_PROJECT_STAFFING_MEMBER.code(),
                    user.getLoginId()
                );
            }
            throw ex;
        }

        return toResourceResult(saved);
    }

    @Transactional
    public ProjectStaffingResourceResult updateProjectStaffing(
        String loginId,
        Long teamId,
        Long projectId,
        Long staffingId,
        UpdateProjectStaffingCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var staffing = findByProjectAndId(context.project(), staffingId);

        staffing.update(
            command.grade(),
            command.monthlyRate(),
            command.plannedStartDate(),
            command.plannedEndDate(),
            command.plannedParticipationRate(),
            command.actualStartDate(),
            command.actualEndDate(),
            command.actualParticipationRate()
        );

        return toResourceResult(staffing);
    }

    @Transactional
    public void deleteProjectStaffing(String loginId, Long teamId, Long projectId, Long staffingId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var staffing = findByProjectAndId(context.project(), staffingId);
        projectStaffingRepository.delete(staffing);
    }

    private User resolveUser(Long userId) {
        return userRepository
            .findById(Objects.requireNonNull(userId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), userId));
    }

    private void verifyTeamMembership(Team team, User user) {
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
        }
    }

    private ProjectStaffing findByProjectAndId(com.smarterd.domain.project.entity.Project project, Long staffingId) {
        return projectStaffingRepository
            .findByProjectAndId(project, Objects.requireNonNull(staffingId))
            .orElseThrow(() ->
                new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_STAFFING.code(), staffingId)
            );
    }

    private ProjectStaffingResourceResult toResourceResult(ProjectStaffing staffing) {
        final var plannedCalculation = staffingAllocationCalculator.calculate(
            staffing.getPlannedStartDate(),
            staffing.getPlannedEndDate(),
            staffing.getPlannedParticipationRate(),
            staffing.getMonthlyRate()
        );

        final StaffingAllocationCalculator.StaffingCalculationResult actualCalculation;
        if (staffing.hasActualData()) {
            actualCalculation = staffingAllocationCalculator.calculate(
                Objects.requireNonNull(staffing.getActualStartDate()),
                Objects.requireNonNull(staffing.getActualEndDate()),
                Objects.requireNonNull(staffing.getActualParticipationRate()),
                staffing.getMonthlyRate()
            );
        } else {
            actualCalculation = null;
        }

        final var monthlyAllocations = mergeMonthlyAllocations(
            plannedCalculation.monthlyAllocations(),
            actualCalculation == null ? List.of() : actualCalculation.monthlyAllocations()
        );
        final var actualMm = actualCalculation == null ? null : actualCalculation.totalMm();
        final var actualCost = actualCalculation == null ? null : actualCalculation.cost();
        final var deltaMm = actualMm == null ? null : roundMm(actualMm.subtract(plannedCalculation.totalMm()));

        final var user = staffing.getUser();
        return new ProjectStaffingResourceResult(
            staffing.getId(),
            user.getId(),
            user.getName(),
            user.getLoginId(),
            staffing.getGrade(),
            staffing.getMonthlyRate(),
            staffing.getPlannedStartDate(),
            staffing.getPlannedEndDate(),
            staffing.getPlannedParticipationRate(),
            plannedCalculation.totalMm(),
            plannedCalculation.cost(),
            staffing.getActualStartDate(),
            staffing.getActualEndDate(),
            staffing.getActualParticipationRate(),
            actualMm,
            actualCost,
            deltaMm,
            monthlyAllocations,
            staffing.getCreatedAt(),
            staffing.getUpdatedAt()
        );
    }

    private List<ProjectStaffingMonthlyAllocationResult> mergeMonthlyAllocations(
        List<StaffingAllocationCalculator.StaffingMonthlyAllocation> plannedAllocations,
        List<StaffingAllocationCalculator.StaffingMonthlyAllocation> actualAllocations
    ) {
        final Map<String, BigDecimal> plannedByMonth = plannedAllocations
            .stream()
            .collect(
                LinkedHashMap::new,
                (map, allocation) -> map.put(allocation.month(), allocation.mm()),
                Map::putAll
            );
        final Map<String, BigDecimal> actualByMonth = actualAllocations
            .stream()
            .collect(
                LinkedHashMap::new,
                (map, allocation) -> map.put(allocation.month(), allocation.mm()),
                Map::putAll
            );

        return java.util.stream.Stream.concat(plannedByMonth.keySet().stream(), actualByMonth.keySet().stream())
            .distinct()
            .sorted()
            .map((month) -> {
                final var plannedMm = plannedByMonth.getOrDefault(month, ZERO_MM);
                final var actualMm = actualByMonth.get(month);
                final var deltaMm = actualMm == null ? null : roundMm(actualMm.subtract(plannedMm));
                return new ProjectStaffingMonthlyAllocationResult(month, plannedMm, actualMm, deltaMm);
            })
            .toList();
    }

    private ProjectStaffingSummaryResult toSummary(List<ProjectStaffingResourceResult> resources) {
        final var plannedMm = roundMm(
            resources.stream().map(ProjectStaffingResourceResult::plannedMm).reduce(BigDecimal.ZERO, BigDecimal::add)
        );
        final var actualMm = roundMm(
            resources
                .stream()
                .map(ProjectStaffingResourceResult::actualMm)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
        );
        final var deltaMm = roundMm(actualMm.subtract(plannedMm));
        final var plannedCost = resources
            .stream()
            .map(ProjectStaffingResourceResult::plannedCost)
            .reduce(0L, this::sumCostChecked);
        final var actualCost = resources
            .stream()
            .map(ProjectStaffingResourceResult::actualCost)
            .filter(Objects::nonNull)
            .reduce(0L, this::sumCostChecked);

        return new ProjectStaffingSummaryResult(plannedMm, actualMm, deltaMm, plannedCost, actualCost);
    }

    private long sumCostChecked(long left, long right) {
        try {
            return Math.addExact(left, right);
        } catch (ArithmeticException ex) {
            throw new com.smarterd.domain.common.exception.BusinessException(
                MessageCode.ERROR_BUSINESS_STAFFING_COST_OUT_OF_RANGE.code()
            );
        }
    }

    private BigDecimal roundMm(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isProjectMemberUniqueConstraintViolation(DataIntegrityViolationException ex) {
        final var mostSpecificCause = AppStringUtils.lowerCaseToEmpty(getMostSpecificCauseMessage(ex));
        return (
            mostSpecificCause.contains("uk_project_staffing_project_user") ||
            (mostSpecificCause.contains("project_staffing") &&
                mostSpecificCause.contains("project_id") &&
                mostSpecificCause.contains("user_id"))
        );
    }

    private String getMostSpecificCauseMessage(Throwable throwable) {
        var current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() == null ? "" : current.getMessage();
    }

    public record CreateProjectStaffingCommand(
        Long userId,
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer actualParticipationRate
    ) {}

    public record UpdateProjectStaffingCommand(
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer actualParticipationRate
    ) {}

    public record ProjectStaffingListResult(
        List<ProjectStaffingResourceResult> resources,
        ProjectStaffingSummaryResult summary,
        List<String> months
    ) {}

    public record ProjectStaffingSummaryResult(
        BigDecimal plannedMm,
        BigDecimal actualMm,
        BigDecimal deltaMm,
        long plannedCost,
        long actualCost
    ) {}

    public record ProjectStaffingMonthlyAllocationResult(
        String month,
        BigDecimal plannedMm,
        @Nullable BigDecimal actualMm,
        @Nullable BigDecimal deltaMm
    ) {}

    public record ProjectStaffingResourceResult(
        Long id,
        Long userId,
        String memberName,
        @Nullable String memberLoginId,
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        BigDecimal plannedMm,
        long plannedCost,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer actualParticipationRate,
        @Nullable BigDecimal actualMm,
        @Nullable Long actualCost,
        @Nullable BigDecimal deltaMm,
        List<ProjectStaffingMonthlyAllocationResult> monthlyAllocations,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
