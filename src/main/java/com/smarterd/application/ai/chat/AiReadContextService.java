package com.smarterd.application.ai.chat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Collects authorized read-only context summaries for AI chat.
 */
@Service
public class AiReadContextService {

    public ReadContext read(String loginId, ReadCommand command) {
        return new ReadContext(List.of(), List.of(), List.of("Read context is not implemented yet."), Map.of());
    }

    public enum ReadTool {
        OVERVIEW,
        WBS,
        MILESTONES,
        ISSUES,
        TODO,
        HISTORY,
    }

    public record ReadCommand(
        Long teamId,
        List<Long> projectIds,
        Set<ReadTool> tools,
        boolean memberTodoSummaryRequested,
        String memberLoginId
    ) {
        public ReadCommand {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            tools = tools == null ? Set.of() : Set.copyOf(tools);
        }
    }

    public record SourceChip(String projectName, String tool, int count) {}

    public record ReadContext(
        List<String> confirmedFacts,
        List<SourceChip> sourceChips,
        List<String> needsConfirmation,
        Map<String, Object> sanitizedContext
    ) {
        public ReadContext {
            confirmedFacts = confirmedFacts == null ? List.of() : List.copyOf(confirmedFacts);
            sourceChips = sourceChips == null ? List.of() : List.copyOf(sourceChips);
            needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
            sanitizedContext = sanitizedContext == null ? Map.of() : Map.copyOf(sanitizedContext);
        }
    }
}
