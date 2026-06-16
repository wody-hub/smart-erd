package com.smarterd.domain.pm.issue.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import com.smarterd.utils.AppStringUtils;
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
 * 프로젝트 이슈 엔티티.
 */
@Entity
@Table(name = "project_issues")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProjectIssue extends BaseAuditEntity {

    public static final int MAX_TITLE_LENGTH = 200;
    public static final int MAX_DESCRIPTION_LENGTH = 4000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_user_id")
    private User assignee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectIssueStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectIssuePriority priority;

    @Column(nullable = false, length = MAX_TITLE_LENGTH)
    private String title;

    @Nullable
    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder
    public ProjectIssue(
        Project project,
        @Nullable User assignee,
        ProjectIssueStatus status,
        ProjectIssuePriority priority,
        String title,
        @Nullable String description
    ) {
        this.project = project;
        this.assignee = assignee;
        this.status = status;
        this.priority = priority;
        this.title = normalizeTitle(title);
        this.description = normalizeDescription(description);
    }

    /**
     * 제목/내용/우선순위/담당자를 갱신한다.
     *
     * @param title 새 제목
     * @param description 새 내용
     * @param priority 새 우선순위
     * @param assignee 새 담당자
     */
    public void update(
        String title,
        @Nullable String description,
        ProjectIssuePriority priority,
        @Nullable User assignee
    ) {
        this.title = normalizeTitle(title);
        this.description = normalizeDescription(description);
        this.priority = priority;
        this.assignee = assignee;
    }

    /**
     * 상태를 다음 전진 단계로 이동한다.
     */
    public void advanceStatus() {
        final var nextStatus = status.next();
        if (nextStatus == null) {
            throw new ConflictException(MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_STATUS_TRANSITION_INVALID.code());
        }
        this.status = nextStatus;
    }

    /**
     * 제목을 trim 규칙과 길이 제한에 맞춰 정규화한다.
     *
     * @param value 원본 제목
     * @return 정규화된 제목
     */
    private static String normalizeTitle(String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_TITLE_REQUIRED.code());
        }
        if (normalized.length() > MAX_TITLE_LENGTH) {
            throw new BusinessException(
                MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_TITLE_TOO_LONG.code(),
                MAX_TITLE_LENGTH
            );
        }
        return normalized;
    }

    /**
     * 내용을 trim 규칙과 길이 제한에 맞춰 정규화한다.
     *
     * @param value 원본 내용
     * @return 정규화된 내용, 비어 있으면 {@code null}
     */
    @Nullable
    private static String normalizeDescription(@Nullable String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized != null && normalized.length() > MAX_DESCRIPTION_LENGTH) {
            throw new BusinessException(
                MessageCode.ERROR_BUSINESS_PROJECT_ISSUE_DESCRIPTION_TOO_LONG.code(),
                MAX_DESCRIPTION_LENGTH
            );
        }
        return normalized;
    }
}
