package com.smarterd.domain.markdown.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.Yaml;

/**
 * markdown content artifact에서 허브/상세에 필요한 메타 요약을 추출한다.
 */
@Service
public class MarkdownDocumentDescriptorService {

    private static final Pattern FRONTMATTER_PATTERN = Pattern.compile(
        "\\A---\\R(.*?)\\R---\\R?(.*)\\z",
        Pattern.DOTALL
    );

    private final MarkdownTemplateService markdownTemplateService;
    private final Yaml yaml = new Yaml();

    public MarkdownDocumentDescriptorService(MarkdownTemplateService markdownTemplateService) {
        this.markdownTemplateService = markdownTemplateService;
    }

    /**
     * markdown content에서 템플릿/요약 정보를 추출한다.
     *
     * @param content serialized markdown buffer
     * @return 템플릿 descriptor
     */
    @NonNull
    public MarkdownTemplateDescriptor describe(@Nullable String content) {
        if (content == null || content.isBlank()) {
            return new MarkdownTemplateDescriptor(null, null, null, List.of());
        }

        final Matcher matcher = FRONTMATTER_PATTERN.matcher(content);
        final var frontmatter = matcher.matches() ? matcher.group(1) : null;
        final var body = matcher.matches() ? matcher.group(2) : content;
        final var frontmatterMap = parseFrontmatter(frontmatter);
        final var templateKey = extractString(frontmatterMap.get("template"));
        final var summaryText = extractSummary(body);
        final var tags = extractTags(frontmatterMap.get("tags"));
        return new MarkdownTemplateDescriptor(
            templateKey,
            markdownTemplateService.resolveTemplateLabel(templateKey),
            summaryText,
            tags
        );
    }

    private Map<String, Object> parseFrontmatter(@Nullable String frontmatter) {
        if (frontmatter == null || frontmatter.isBlank()) {
            return Map.of();
        }
        final var loaded = yaml.load(frontmatter);
        if (loaded instanceof Map<?, ?> map) {
            final var result = new java.util.LinkedHashMap<String, Object>();
            map.forEach((key, value) -> {
                if (key != null) {
                    result.put(key.toString(), value);
                }
            });
            return result;
        }
        return Map.of();
    }

    @Nullable
    private String extractString(@Nullable Object value) {
        if (value == null) {
            return null;
        }
        final var normalized = value.toString().trim();
        return normalized.isBlank() ? null : normalized;
    }

    private List<String> extractTags(@Nullable Object value) {
        final var tags = new LinkedHashSet<String>();
        if (value instanceof Iterable<?> iterable) {
            for (final var entry : iterable) {
                final var normalized = normalizeTag(entry);
                if (normalized != null) {
                    tags.add(normalized);
                }
            }
        } else if (value != null) {
            final var raw = value.toString().trim();
            if (!raw.isBlank()) {
                final var parts = raw.startsWith("[") && raw.endsWith("]")
                    ? raw.substring(1, raw.length() - 1).split(",")
                    : new String[] { raw };
                for (final var part : parts) {
                    final var normalized = normalizeTag(part);
                    if (normalized != null) {
                        tags.add(normalized);
                    }
                }
            }
        }
        return List.copyOf(tags);
    }

    @Nullable
    private String normalizeTag(@Nullable Object value) {
        if (value == null) {
            return null;
        }
        final var normalized = value.toString().trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    @Nullable
    private String extractSummary(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        for (String rawLine : body.split("\\R")) {
            final var line = rawLine.trim();
            if (line.isBlank()) {
                continue;
            }
            if (line.startsWith("#")) {
                continue;
            }
            if (line.startsWith("- ") || line.startsWith("* ") || line.matches("^\\d+\\.\\s+.*$")) {
                return truncate(line.replaceFirst("^([-*]|\\d+\\.)\\s+", ""));
            }
            return truncate(line);
        }
        return null;
    }

    private String truncate(String value) {
        return value.length() <= 120 ? value : value.substring(0, 117) + "...";
    }
}
