package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkActivityResult;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import org.springframework.lang.Nullable;

/**
 * WBS 활동 로그 응답.
 */
@Schema(description = "WBS 활동 로그 응답")
public record WbsActivityResponse(
    @Schema(description = "활동 로그 ID", example = "2001") Long id,
    @Schema(description = "이벤트 유형", example = "WBS_UPDATED") WorkActivityEventType eventType,
    @Schema(description = "대상 유형") @Nullable WorkActivitySubjectType subjectType,
    @Schema(description = "대상 ID", example = "101") @Nullable Long subjectId,
    @Schema(description = "대상 표시명", example = "요구사항 분석") @Nullable String subjectLabel,
    @Schema(description = "이전 값") @Nullable String previousValue,
    @Schema(description = "현재 값") @Nullable String currentValue,
    @Schema(description = "상세 설명") @Nullable String detail,
    @Schema(description = "행위자 로그인 ID", example = "kim") @Nullable String actorLoginId,
    @Schema(description = "행위자 이름", example = "김개발") @Nullable String actorName,
    @Schema(description = "발생 시각 (UTC, ISO-8601)") Instant occurredAt
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
