package com.smarterd.domain.pm.history.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.project.entity.Project;
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
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 작업 대상에 대한 시스템 활동 로그.
 */
@Entity
@Table(name = "work_activities")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkActivity extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    private WorkTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    private WorkActivityEventType eventType;

    @Nullable
    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", length = 30)
    private WorkActivitySubjectType subjectType;

    @Nullable
    @Column(name = "subject_id")
    private Long subjectId;

    @Nullable
    @Column(name = "subject_label", length = 200)
    private String subjectLabel;

    @Nullable
    @Column(name = "previous_value", length = 100)
    private String previousValue;

    @Nullable
    @Column(name = "current_value", length = 100)
    private String currentValue;

    @Nullable
    @Column(length = 500)
    private String detail;

    @Builder
    public WorkActivity(
        Project project,
        WorkTargetType targetType,
        Long targetId,
        WorkActivityEventType eventType,
        @Nullable WorkActivitySubjectType subjectType,
        @Nullable Long subjectId,
        @Nullable String subjectLabel,
        @Nullable String previousValue,
        @Nullable String currentValue,
        @Nullable String detail
    ) {
        this.project = project;
        this.targetType = targetType;
        this.targetId = targetId;
        this.eventType = eventType;
        this.subjectType = subjectType;
        this.subjectId = subjectId;
        this.subjectLabel = subjectLabel;
        this.previousValue = previousValue;
        this.currentValue = currentValue;
        this.detail = detail;
    }
}
