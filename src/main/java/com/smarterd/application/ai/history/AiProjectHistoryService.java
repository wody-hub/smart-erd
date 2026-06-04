package com.smarterd.application.ai.history;

import com.smarterd.domain.ai.AiActionProposal;
import com.smarterd.domain.ai.AiActionProposalRepository;
import com.smarterd.domain.ai.AiExecutionAudit;
import com.smarterd.domain.ai.AiExecutionAuditRepository;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads project-scoped AI execution and proposal history as sanitized metadata.
 */
@Service
@RequiredArgsConstructor
public class AiProjectHistoryService {

    public static final int DEFAULT_LIMIT = 50;
    public static final int MAX_LIMIT = 100;

    private static final String HIDDEN_PERSONAL_TODO_SUMMARY = "Personal TODO detail hidden";

    private final ProjectContextLoader projectContextLoader;
    private final AiActionProposalRepository proposalRepository;
    private final AiExecutionAuditRepository auditRepository;

    /**
     * Returns authorized, redacted AI history rows for one project.
     *
     * @param loginId requester login id
     * @param teamId team id
     * @param projectId project id
     * @param limit requested item limit
     * @return sanitized project AI history
     */
    @Transactional(readOnly = true)
    public AiProjectHistoryView getProjectHistory(String loginId, Long teamId, Long projectId, Integer limit) {
        projectContextLoader.load(loginId, teamId, projectId, false);
        final var effectiveLimit = normalizeLimit(limit);
        final var page = PageRequest.of(
            0,
            effectiveLimit + 1,
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))
        );
        final var proposals = proposalRepository.findByTeamIdAndProjectId(teamId, projectId, page);
        final var audits = auditRepository.findByTeamIdAndProjectId(teamId, projectId, page);
        final var rows = new ArrayList<AiProjectHistoryItemView>();
        proposals.forEach(proposal -> rows.add(fromProposal(loginId, proposal)));
        audits.forEach(audit -> rows.add(fromAudit(loginId, audit)));
        rows.sort(newestFirst());
        final var hasMore = rows.size() > effectiveLimit || proposals.size() > effectiveLimit || audits.size() > effectiveLimit;
        final var items = rows.stream().limit(effectiveLimit).toList();
        return new AiProjectHistoryView(effectiveLimit, hasMore, items);
    }

    /**
     * Clamps the requested limit to the supported history window.
     *
     * @param limit requested item limit
     * @return normalized limit
     */
    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    /**
     * Maps a persisted proposal into a sanitized history row.
     *
     * @param loginId requester login id
     * @param proposal proposal entity
     * @return sanitized history row
     */
    private AiProjectHistoryItemView fromProposal(String loginId, AiActionProposal proposal) {
        final var privateTodo = isPrivateTodoForViewer(
            loginId,
            proposal.getRequestedBy(),
            proposal.getActionType(),
            proposal.getTargetType(),
            proposal.getTargetId(),
            proposal.getTargetLabel()
        );
        return new AiProjectHistoryItemView(
            "PROPOSAL",
            proposal.getExecutionId(),
            proposal.getProposalId(),
            proposal.getProvider(),
            proposal.getPromptVersion(),
            proposal.getActionType(),
            proposal.getRiskLevel() == null ? null : proposal.getRiskLevel().name(),
            proposal.getStatus().name(),
            proposal.getTargetType(),
            privateTodo ? null : proposal.getTargetId(),
            privateTodo ? null : proposal.getTargetLabel(),
            privateTodo ? HIDDEN_PERSONAL_TODO_SUMMARY : proposal.getSummary(),
            proposal.getRequestedBy(),
            proposal.getDecisionBy(),
            proposal.getCreatedAt(),
            proposal.getDecidedAt(),
            proposal.getRedactedErrorTitle(),
            proposal.getRedactedErrorDetail(),
            activityAt(proposal.getCreatedAt(), proposal.getDecidedAt())
        );
    }

    /**
     * Maps a persisted audit row into a sanitized history row.
     *
     * @param loginId requester login id
     * @param audit audit entity
     * @return sanitized history row
     */
    private AiProjectHistoryItemView fromAudit(String loginId, AiExecutionAudit audit) {
        final var privateTodo = isPrivateTodoForViewer(
            loginId,
            audit.getRequestedBy(),
            audit.getActionType(),
            audit.getTargetType(),
            audit.getTargetId(),
            audit.getTargetLabel()
        );
        return new AiProjectHistoryItemView(
            "AUDIT",
            audit.getExecutionId(),
            audit.getProposalId(),
            audit.getProvider(),
            audit.getPromptVersion(),
            audit.getActionType(),
            audit.getRiskLevel(),
            audit.getStatus(),
            audit.getTargetType(),
            privateTodo ? null : audit.getTargetId(),
            privateTodo ? null : audit.getTargetLabel(),
            privateTodo ? HIDDEN_PERSONAL_TODO_SUMMARY : auditSummary(audit),
            audit.getRequestedBy(),
            audit.getDecisionBy(),
            audit.getCreatedAt(),
            audit.getDecidedAt(),
            audit.getRedactedErrorTitle(),
            audit.getRedactedErrorDetail(),
            activityAt(audit.getCreatedAt(), audit.getDecidedAt())
        );
    }

    /**
     * Builds a safe summary for audit-only rows.
     *
     * @param audit audit entity
     * @return summary text
     */
    private String auditSummary(AiExecutionAudit audit) {
        if (audit.getRedactedErrorTitle() != null && !audit.getRedactedErrorTitle().isBlank()) {
            return audit.getRedactedErrorTitle();
        }
        if (audit.getTargetLabel() != null && !audit.getTargetLabel().isBlank()) {
            return audit.getTargetLabel();
        }
        return audit.getStatus();
    }

    /**
     * Determines whether TODO detail should be hidden from the current viewer.
     *
     * @param loginId requester login id
     * @param requestedBy proposal requester
     * @param actionType action type
     * @param targetType target type
     * @param targetId target id
     * @param targetLabel target label
     * @return true when TODO details are private for this viewer
     */
    private boolean isPrivateTodoForViewer(
        String loginId,
        String requestedBy,
        String actionType,
        String targetType,
        String targetId,
        String targetLabel
    ) {
        return isTodo(actionType, targetType) && !Objects.equals(loginId, requestedBy) && !hasProjectVisibleWbsMarker(targetType, targetId, targetLabel);
    }

    /**
     * Detects TODO-related action or target metadata.
     *
     * @param actionType action type
     * @param targetType target type
     * @return true when either value points to TODO
     */
    private boolean isTodo(String actionType, String targetType) {
        return contains(actionType, "todo") || contains(targetType, "todo");
    }

    /**
     * Detects project-visible WBS markers used to keep TODO rows visible.
     *
     * @param targetType target type
     * @param targetId target id
     * @param targetLabel target label
     * @return true when WBS metadata is present
     */
    private boolean hasProjectVisibleWbsMarker(String targetType, String targetId, String targetLabel) {
        return contains(targetType, "wbs") || contains(targetId, "wbs:") || contains(targetLabel, "[wbs]");
    }

    /**
     * Case-insensitive substring check for nullable metadata.
     *
     * @param value metadata value
     * @param needle expected substring
     * @return true when value contains needle
     */
    private boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    /**
     * Picks the timestamp used for newest-first history sorting.
     *
     * @param createdAt creation timestamp
     * @param decidedAt decision timestamp
     * @return decision timestamp, creation timestamp, or null
     */
    private Instant activityAt(Instant createdAt, Instant decidedAt) {
        return decidedAt == null ? createdAt : decidedAt;
    }

    /**
     * Creates a comparator that keeps null timestamps last.
     *
     * @return newest-first comparator
     */
    private Comparator<AiProjectHistoryItemView> newestFirst() {
        return (left, right) -> {
            if (left.activityAt() == null && right.activityAt() == null) {
                return 0;
            }
            if (left.activityAt() == null) {
                return 1;
            }
            if (right.activityAt() == null) {
                return -1;
            }
            return right.activityAt().compareTo(left.activityAt());
        };
    }

    public record AiProjectHistoryView(int limit, boolean hasMore, List<AiProjectHistoryItemView> items) {
        /**
         * Normalizes nullable item collections.
         *
         * @param limit effective limit
         * @param hasMore pagination hint
         * @param items history items
         * @return initialized history view
         */
        public AiProjectHistoryView {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

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
}
