package com.smarterd.domain.markdown.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.DumperOptions;
import org.yaml.snakeyaml.Yaml;

/**
 * 마크다운 문서 템플릿을 관리한다.
 */
@Service
public class MarkdownTemplateService {

    private static final String DEFAULT_TEMPLATE_KEY = "technical-spec";

    private static final Map<String, String> TEMPLATE_LABELS = Map.of(
        DEFAULT_TEMPLATE_KEY,
        "Technical Spec",
        "meeting-notes",
        "Meeting Notes",
        "release-note",
        "Release Note"
    );

    private final Yaml yaml;

    public MarkdownTemplateService() {
        final var options = new DumperOptions();
        options.setDefaultFlowStyle(DumperOptions.FlowStyle.BLOCK);
        options.setPrettyFlow(true);
        options.setSplitLines(false);
        options.setIndent(2);
        this.yaml = new Yaml(options);
    }

    /**
     * 신규 markdown 문서의 초기 content artifact를 만든다.
     *
     * @param documentName 문서 이름
     * @param templateKey 요청 템플릿 키
     * @return serialized markdown buffer
     */
    public String buildInitialContent(String documentName, @Nullable String templateKey) {
        final var resolvedTemplateKey = resolveTemplateKey(templateKey);
        return switch (resolvedTemplateKey) {
            case "meeting-notes" -> buildMeetingNotes(documentName, resolvedTemplateKey);
            case "release-note" -> buildReleaseNote(documentName, resolvedTemplateKey);
            default -> buildTechnicalSpec(documentName, resolvedTemplateKey);
        };
    }

    /**
     * 허용된 템플릿 키를 정규화한다.
     *
     * @param templateKey 요청 템플릿 키
     * @return 정규화된 템플릿 키
     */
    public String resolveTemplateKey(@Nullable String templateKey) {
        final var resolvedTemplateKey =
            templateKey == null || templateKey.isBlank() ? DEFAULT_TEMPLATE_KEY : templateKey.trim();
        if (!TEMPLATE_LABELS.containsKey(resolvedTemplateKey)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_MARKDOWN_TEMPLATE_INVALID.code());
        }
        return resolvedTemplateKey;
    }

    /**
     * 템플릿 표시 이름을 반환한다.
     *
     * @param templateKey 템플릿 키
     * @return 템플릿 라벨
     */
    @Nullable
    public String resolveTemplateLabel(@Nullable String templateKey) {
        if (templateKey == null || templateKey.isBlank()) {
            return null;
        }
        return TEMPLATE_LABELS.get(templateKey);
    }

    /**
     * 기술 스펙 템플릿으로 초기 마크다운 콘텐츠를 생성한다.
     *
     * @param documentName 문서 이름
     * @param templateKey  템플릿 키
     * @return 직렬화된 마크다운 문자열
     */
    private String buildTechnicalSpec(String documentName, String templateKey) {
        final var frontmatter = new LinkedHashMap<String, Object>();
        frontmatter.put("title", documentName);
        frontmatter.put("template", templateKey);
        frontmatter.put("status", "draft");
        frontmatter.put("owner", "unassigned");
        frontmatter.put("date", LocalDate.now().toString());
        frontmatter.put("tags", List.of("spec"));
        return (
            serialize(frontmatter) +
            "# " +
            documentName +
            "\n\n" +
            "## Summary\n\n" +
            "Describe the goal, scope, and intended audience of this document.\n\n" +
            "## Background\n\n" +
            "- Current context\n" +
            "- Constraints\n" +
            "- Dependencies\n\n" +
            "## Proposed Approach\n\n" +
            "Outline the technical direction, trade-offs, and rollout plan.\n"
        );
    }

    /**
     * 회의록 템플릿으로 초기 마크다운 콘텐츠를 생성한다.
     *
     * @param documentName 문서 이름
     * @param templateKey  템플릿 키
     * @return 직렬화된 마크다운 문자열
     */
    private String buildMeetingNotes(String documentName, String templateKey) {
        final var frontmatter = new LinkedHashMap<String, Object>();
        frontmatter.put("title", documentName);
        frontmatter.put("template", templateKey);
        frontmatter.put("status", "draft");
        frontmatter.put("date", LocalDate.now().toString());
        frontmatter.put("tags", List.of("meeting"));
        return (
            serialize(frontmatter) +
            "# " +
            documentName +
            "\n\n" +
            "## Meeting Info\n\n" +
            "- Date: " +
            LocalDate.now() +
            "\n" +
            "- Participants: \n" +
            "- Agenda: \n\n" +
            "## Notes\n\n" +
            "- \n\n" +
            "## Action Items\n\n" +
            "- [ ] \n"
        );
    }

    /**
     * 릴리스 노트 템플릿으로 초기 마크다운 콘텐츠를 생성한다.
     *
     * @param documentName 문서 이름
     * @param templateKey  템플릿 키
     * @return 직렬화된 마크다운 문자열
     */
    private String buildReleaseNote(String documentName, String templateKey) {
        final var frontmatter = new LinkedHashMap<String, Object>();
        frontmatter.put("title", documentName);
        frontmatter.put("template", templateKey);
        frontmatter.put("status", "draft");
        frontmatter.put("date", LocalDate.now().toString());
        frontmatter.put("tags", List.of("release"));
        return (
            serialize(frontmatter) +
            "# " +
            documentName +
            "\n\n" +
            "## Highlights\n\n" +
            "- \n\n" +
            "## Improvements\n\n" +
            "- \n\n" +
            "## Notes\n\n" +
            "- \n"
        );
    }

    /**
     * frontmatter 맵을 YAML 형식으로 직렬화하여 마크다운 프론트매터 블록을 생성한다.
     *
     * @param frontmatter 직렬화할 프론트매터 키-값 맵
     * @return {@code ---} 구분자로 감싼 YAML 프론트매터 문자열
     */
    private String serialize(Map<String, Object> frontmatter) {
        return "---\n" + yaml.dump(frontmatter).trim() + "\n---\n\n";
    }
}
