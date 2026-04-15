package com.smarterd.domain.markdown.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

/**
 * markdown content artifact에서 허브/상세에 필요한 메타 요약을 추출한다.
 */
@Service
public class MarkdownDocumentDescriptorService {

    private static final Pattern FRONTMATTER_PATTERN = Pattern.compile(
        "\\A---\\R(.*?)\\R---\\R?(.*)\\z",
        Pattern.DOTALL
    );
    private static final Pattern SIMPLE_FIELD_PATTERN = Pattern.compile("(?m)^%s:\\s*(.+?)\\s*$");

    private final MarkdownTemplateService markdownTemplateService;

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
            return new MarkdownTemplateDescriptor(null, null, null);
        }

        final Matcher matcher = FRONTMATTER_PATTERN.matcher(content);
        final var frontmatter = matcher.matches() ? matcher.group(1) : null;
        final var body = matcher.matches() ? matcher.group(2) : content;
        final var templateKey = extractField(frontmatter, "template");
        final var summaryText = extractSummary(body);
        return new MarkdownTemplateDescriptor(
            templateKey,
            markdownTemplateService.resolveTemplateLabel(templateKey),
            summaryText
        );
    }

    @Nullable
    private String extractField(@Nullable String frontmatter, String key) {
        if (frontmatter == null || frontmatter.isBlank()) {
            return null;
        }
        final var pattern = Pattern.compile(String.format(SIMPLE_FIELD_PATTERN.pattern(), Pattern.quote(key)));
        final Matcher matcher = pattern.matcher(frontmatter);
        return matcher.find() ? matcher.group(1).trim() : null;
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
