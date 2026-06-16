package com.smarterd.application.ai.history;

import java.time.Instant;

public record AiProjectHistoryItemView(
    String kind,
    String executionId,
    String proposalId,
    String provider,
    String promptVersion,
    String actionType,
    String riskLevel,
    String status,
    String targetType,
    String targetId,
    String targetLabel,
    String summary,
    String requestedBy,
    String decisionBy,
    Instant createdAt,
    Instant decidedAt,
    String redactedErrorTitle,
    String redactedErrorDetail,
    Instant activityAt
) {}
