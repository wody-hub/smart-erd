package com.smarterd.domain.pm.staffing.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 인력 투입 엔티티.
 */
@Entity
@Table(name = "project_staffing")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProjectStaffing extends BaseAuditEntity {

    public static final long MAX_MONTHLY_RATE_KRW = 999_999_999L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StaffingGrade grade;

    @Column(name = "monthly_rate", nullable = false)
    private long monthlyRate;

    @Column(name = "planned_start_date", nullable = false)
    private LocalDate plannedStartDate;

    @Column(name = "planned_end_date", nullable = false)
    private LocalDate plannedEndDate;

    @Column(name = "planned_participation_rate", nullable = false)
    private int plannedParticipationRate;

    @Nullable
    @Column(name = "actual_start_date")
    private LocalDate actualStartDate;

    @Nullable
    @Column(name = "actual_end_date")
    private LocalDate actualEndDate;

    @Nullable
    @Column(name = "actual_participation_rate")
    private Integer actualParticipationRate;

    @Builder
    public ProjectStaffing(
        Project project,
        User user,
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer actualParticipationRate
    ) {
        this.project = project;
        this.user = user;
        this.grade = grade;
        this.monthlyRate = monthlyRate;
        this.plannedStartDate = plannedStartDate;
        this.plannedEndDate = plannedEndDate;
        this.plannedParticipationRate = plannedParticipationRate;
        this.actualStartDate = actualStartDate;
        this.actualEndDate = actualEndDate;
        this.actualParticipationRate = actualParticipationRate;
        validateInvariants();
    }

    public void update(
        StaffingGrade grade,
        long monthlyRate,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        int plannedParticipationRate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer actualParticipationRate
    ) {
        this.grade = grade;
        this.monthlyRate = monthlyRate;
        this.plannedStartDate = plannedStartDate;
        this.plannedEndDate = plannedEndDate;
        this.plannedParticipationRate = plannedParticipationRate;
        this.actualStartDate = actualStartDate;
        this.actualEndDate = actualEndDate;
        this.actualParticipationRate = actualParticipationRate;
        validateInvariants();
    }

    public boolean hasActualData() {
        return actualStartDate != null && actualEndDate != null && actualParticipationRate != null;
    }

    private void validateInvariants() {
        if (monthlyRate < 0 || monthlyRate > MAX_MONTHLY_RATE_KRW) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_MONTHLY_RATE_OUT_OF_RANGE.code());
        }

        if (plannedParticipationRate < 0 || plannedParticipationRate > 100) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE.code());
        }

        if (actualParticipationRate != null && (actualParticipationRate < 0 || actualParticipationRate > 100)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE.code());
        }

        if (plannedStartDate == null || plannedEndDate == null || plannedStartDate.isAfter(plannedEndDate)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_STAFFING_PERIOD.code());
        }

        final var actualAllNull = actualStartDate == null && actualEndDate == null && actualParticipationRate == null;
        final var actualAllPresent =
            actualStartDate != null && actualEndDate != null && actualParticipationRate != null;
        if (!actualAllNull && !actualAllPresent) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_STAFFING_ACTUAL_PERIOD.code());
        }

        if (actualAllPresent && actualStartDate.isAfter(actualEndDate)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_STAFFING_ACTUAL_PERIOD.code());
        }
    }
}
