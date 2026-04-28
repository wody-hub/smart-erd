package com.smarterd.domain.pm.todo.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
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
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 컨텍스트에 속한 개인 TODO 엔티티.
 */
@Entity
@Table(name = "project_todos")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProjectTodo extends BaseAuditEntity {

    public static final int MAX_TITLE_LENGTH = 200;
    public static final int MAX_DESCRIPTION_LENGTH = 4000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User owner;

    @Nullable
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_wbs_item_id")
    private WbsItem linkedWbsItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectTodoStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectTodoPriority priority;

    @Column(nullable = false, length = MAX_TITLE_LENGTH)
    private String title;

    @Nullable
    @Column(columnDefinition = "TEXT")
    private String description;

    @Nullable
    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "progress_rate", nullable = false)
    private int progressRate;

    @Builder
    public ProjectTodo(
        Project project,
        User owner,
        @Nullable WbsItem linkedWbsItem,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        String title,
        @Nullable String description,
        @Nullable LocalDate targetDate,
        int progressRate
    ) {
        this.project = project;
        this.owner = owner;
        this.linkedWbsItem = linkedWbsItem;
        this.status = status;
        this.priority = priority;
        this.title = normalizeTitle(title);
        this.description = normalizeDescription(description);
        this.targetDate = targetDate;
        this.progressRate = progressRate;
        validateInvariants();
    }

    public void update(
        String title,
        @Nullable String description,
        ProjectTodoStatus status,
        ProjectTodoPriority priority,
        @Nullable LocalDate targetDate,
        int progressRate
    ) {
        this.title = normalizeTitle(title);
        this.description = normalizeDescription(description);
        this.status = status;
        this.priority = priority;
        this.targetDate = targetDate;
        this.progressRate = progressRate;
        validateInvariants();
    }

    public void linkToWbs(@Nullable WbsItem linkedWbsItem) {
        this.linkedWbsItem = linkedWbsItem;
    }

    private void validateInvariants() {
        if (progressRate < 0 || progressRate > 100) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_PROJECT_TODO_PROGRESS_RATE_OUT_OF_RANGE.code());
        }
    }

    private static String normalizeTitle(String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_PROJECT_TODO_TITLE_REQUIRED.code());
        }
        if (normalized.length() > MAX_TITLE_LENGTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_PROJECT_TODO_TITLE_TOO_LONG.code(), MAX_TITLE_LENGTH);
        }
        return normalized;
    }

    @Nullable
    private static String normalizeDescription(@Nullable String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized != null && normalized.length() > MAX_DESCRIPTION_LENGTH) {
            throw new BusinessException(
                MessageCode.ERROR_BUSINESS_PROJECT_TODO_DESCRIPTION_TOO_LONG.code(),
                MAX_DESCRIPTION_LENGTH
            );
        }
        return normalized;
    }
}
