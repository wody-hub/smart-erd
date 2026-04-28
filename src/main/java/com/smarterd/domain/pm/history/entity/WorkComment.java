package com.smarterd.domain.pm.history.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.project.entity.Project;
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

/**
 * WBS/TODO/이슈 등 작업 타깃에 붙는 공통 사용자 댓글.
 */
@Entity
@Table(name = "work_comments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkComment extends BaseAuditEntity {

    public static final int MAX_CONTENT_LENGTH = 4000;

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

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Builder
    public WorkComment(Project project, WorkTargetType targetType, Long targetId, String content) {
        this.project = project;
        this.targetType = targetType;
        this.targetId = targetId;
        this.content = normalizeContent(content);
    }

    private static String normalizeContent(String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WORK_COMMENT_CONTENT_REQUIRED.code());
        }
        if (normalized.length() > MAX_CONTENT_LENGTH) {
            throw new BusinessException(
                MessageCode.ERROR_BUSINESS_WORK_COMMENT_CONTENT_TOO_LONG.code(),
                MAX_CONTENT_LENGTH
            );
        }
        return normalized;
    }
}
