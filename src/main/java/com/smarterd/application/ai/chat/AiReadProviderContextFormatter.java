package com.smarterd.application.ai.chat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class AiReadProviderContextFormatter {

    private AiReadProviderContextFormatter() {}

    static Map<String, Object> sanitizedContext(
        List<String> facts,
        List<AiReadContextService.SourceChip> sourceChips,
        Set<AiReadContextService.ReadTool> tools,
        Map<String, Object> capMetadata,
        Map<String, Object> toolData
    ) {
        return Map.of(
            "confirmedFacts",
            facts,
            "sourceChips",
            sourceChips,
            "toolsUsed",
            tools.stream().map(Enum::name).toList(),
            "caps",
            capMetadata,
            "summaries",
            toolData
        );
    }

    static String serializeProviderContext(
        List<String> facts,
        List<AiReadContextService.SourceChip> sourceChips,
        Map<String, Object> capMetadata,
        Map<String, Object> toolData
    ) {
        final var builder = new StringBuilder();
        builder.append("facts:\n");
        for (final var fact : facts) {
            builder.append("- ").append(AiReadToolDataSupport.truncateText(fact)).append('\n');
        }
        builder.append("sources:\n");
        for (final var chip : sourceChips) {
            builder
                .append("- ")
                .append(chip.projectName())
                .append(" - ")
                .append(chip.tool())
                .append(' ')
                .append(chip.count())
                .append('\n');
        }
        builder.append("summaries:\n");
        final var capsComplete = "caps: " + providerContextCaps(capMetadata, false);
        final var completeLength =
            builder.length() +
            toolData
                .entrySet()
                .stream()
                .mapToInt((entry) -> summaryLine(entry).length())
                .sum() +
            capsComplete.length();
        if (completeLength <= AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS) {
            for (final var entry : toolData.entrySet()) {
                builder.append(summaryLine(entry));
            }
            builder.append(capsComplete);
            return builder.toString();
        }

        final var capsTruncated = "caps: " + providerContextCaps(capMetadata, true);
        final var marker = "\n- providerContextTruncated: true\n";
        if (
            builder.length() + marker.length() + capsTruncated.length() >
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS
        ) {
            return appendTruncationFooter(builder, marker, capsTruncated);
        }
        final var maxSummariesLength = Math.max(
            0,
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS -
                builder.length() -
                marker.length() -
                capsTruncated.length()
        );
        var summariesLength = 0;
        for (final var entry : toolData.entrySet()) {
            final var line = summaryLine(entry);
            if (summariesLength + line.length() > maxSummariesLength) {
                break;
            }
            builder.append(line);
            summariesLength += line.length();
        }
        return appendTruncationFooter(builder, marker, capsTruncated);
    }

    static String truncateProviderContext(String providerContext) {
        if (providerContext.length() <= AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS) {
            return providerContext;
        }
        final var marker = "\nproviderContextTruncated=true";
        final var footer =
            marker +
            "\ncaps: {providerContextMaxChars=" +
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS +
            ", providerContextTruncated=true}";
        return (
            providerContext.substring(
                0,
                Math.max(0, AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS - footer.length())
            ) +
            footer
        );
    }

    /**
     * Formats one summary entry as provider context text.
     *
     * @param entry summary entry
     * @return formatted line
     */
    private static String summaryLine(Map.Entry<String, Object> entry) {
        return "- " + entry.getKey() + ": " + entry.getValue() + '\n';
    }

    /**
     * Adds provider context truncation metadata to cap metadata.
     *
     * @param capMetadata base cap metadata
     * @param providerContextTruncated provider context truncation flag
     * @return provider context caps
     */
    private static Map<String, Object> providerContextCaps(
        Map<String, Object> capMetadata,
        boolean providerContextTruncated
    ) {
        final var caps = new LinkedHashMap<String, Object>(capMetadata);
        caps.put("providerContextTruncated", providerContextTruncated);
        return caps;
    }

    /**
     * Appends truncation marker and cap data within the context size limit.
     *
     * @param builder context prefix builder
     * @param marker truncation marker
     * @param caps cap metadata text
     * @return truncated provider context
     */
    private static String appendTruncationFooter(StringBuilder builder, String marker, String caps) {
        final var maxPrefixLength = Math.max(
            0,
            AiReadContextService.MAX_PROVIDER_CONTEXT_CHARS - marker.length() - caps.length()
        );
        final var prefix =
            builder.length() <= maxPrefixLength ? builder.toString() : builder.substring(0, maxPrefixLength);
        return prefix + marker + caps;
    }
}
