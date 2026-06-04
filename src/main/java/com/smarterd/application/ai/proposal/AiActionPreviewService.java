package com.smarterd.application.ai.proposal;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Builds server-owned proposal preview data from sanitized payload values.
 */
@Service
public class AiActionPreviewService {

    public PreviewData preview(Long teamId, Long projectId, Map<String, Object> sanitizedPayload) {
        final var target = new AiActionProposalView.Target(
            stringValue(sanitizedPayload.get("targetType")),
            stringValue(sanitizedPayload.get("targetId")),
            stringValue(sanitizedPayload.get("targetLabel")),
            teamId,
            projectId
        );
        return new PreviewData(
            target,
            fieldChanges(sanitizedPayload.get("fields")),
            stringValue(sanitizedPayload.get("content")),
            List.of()
        );
    }

    private List<AiActionProposalView.FieldChange> fieldChanges(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return List.of();
        }
        final var fields = new ArrayList<AiActionProposalView.FieldChange>();
        for (final var item : iterable) {
            if (item instanceof Map<?, ?> map) {
                fields.add(
                    new AiActionProposalView.FieldChange(
                        stringValue(map.get("label")),
                        stringValue(map.get("beforeValue")),
                        stringValue(map.get("afterValue")),
                        stringValue(map.get("changeType"))
                    )
                );
            }
        }
        return List.copyOf(fields);
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    public record PreviewData(
        AiActionProposalView.Target target,
        List<AiActionProposalView.FieldChange> fields,
        String content,
        List<String> warnings
    ) {
        public PreviewData {
            fields = fields == null ? List.of() : List.copyOf(fields);
            warnings = warnings == null ? List.of() : List.copyOf(warnings);
        }
    }
}
