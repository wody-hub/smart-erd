package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkActivityResult;
import java.time.Instant;
import org.springframework.lang.Nullable;

/**
 * WBS 활동 로그 응답.
 */
public record WbsActivityResponse(
    Long id,
    WorkActivityEventType eventType,
    @Nullable WorkActivitySubjectType subjectType,
    @Nullable Long subjectId,
    @Nullable String subjectLabel,
    @Nullable String previousValue,
    @Nullable String currentValue,
    @Nullable String detail,
    @Nullable String actorLoginId,
    @Nullable String actorName,
    Instant occurredAt
) {
    public static WbsActivityResponse from(WorkActivityResult result) {
        return new WbsActivityResponse(
            result.id(),
            result.eventType(),
            result.subjectType(),
            result.subjectId(),
            result.subjectLabel(),
            result.previousValue(),
            result.currentValue(),
            result.detail(),
            result.actorLoginId(),
            result.actorName(),
            result.occurredAt()
        );
    }
}
