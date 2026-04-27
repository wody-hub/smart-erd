package com.smarterd.domain.pm.wbs.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * WBS 작업 항목 엔티티.
 */
@Entity
@Table(name = "wbs_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WbsItem extends BaseAuditEntity {

    /** 운영 WBS에서 사용하는 중첩 구조를 수용하기 위한 최대 깊이. */
    public static final int MAX_DEPTH = 8;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** 부모 항목 (DB ON DELETE CASCADE — 부모 삭제 시 하위 항목도 함께 삭제됨) */
    @Nullable
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private WbsItem parent;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private int depth;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Nullable
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_user_id")
    private User assignee;

    @Nullable
    @Column(name = "start_date")
    private LocalDate startDate;

    @Nullable
    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "progress_rate", nullable = false)
    private int progressRate;

    @Nullable
    @Column(name = "estimated_mm", precision = 6, scale = 2)
    private BigDecimal estimatedMm;

    @Nullable
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "milestone_id")
    private Milestone milestone;

    @Builder
    public WbsItem(
        Project project,
        @Nullable WbsItem parent,
        String name,
        int depth,
        int sortOrder,
        @Nullable User assignee,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        int progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Milestone milestone
    ) {
        this.project = project;
        this.parent = parent;
        this.name = name;
        this.depth = depth;
        this.sortOrder = sortOrder;
        this.assignee = assignee;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progressRate = progressRate;
        this.estimatedMm = estimatedMm;
        this.milestone = milestone;
        validateInvariants();
    }

    public void update(
        String name,
        @Nullable User assignee,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        int progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Milestone milestone
    ) {
        this.name = name;
        this.assignee = assignee;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progressRate = progressRate;
        this.estimatedMm = estimatedMm;
        this.milestone = milestone;
        validateInvariants();
    }

    public void reorder(@Nullable WbsItem parent, int depth, int sortOrder) {
        this.parent = parent;
        this.depth = depth;
        this.sortOrder = sortOrder;
        validateInvariants();
    }

    public void clearMilestone() {
        this.milestone = null;
    }

    private void validateInvariants() {
        if (depth < 0 || depth > MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }

        if (progressRate < 0 || progressRate > 100) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_PROGRESS_RATE_OUT_OF_RANGE.code());
        }

        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_WBS_PERIOD.code());
        }

        if (estimatedMm != null && estimatedMm.signum() < 0) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_ESTIMATED_MM_OUT_OF_RANGE.code());
        }
    }
}
