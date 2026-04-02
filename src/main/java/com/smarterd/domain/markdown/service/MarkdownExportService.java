package com.smarterd.domain.markdown.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.entity.DiagramPluginId;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

/**
 * markdown 원문 export를 생성한다.
 */
@Service
public class MarkdownExportService {

    /**
     * markdown 문서를 원문 포맷으로 export 한다.
     *
     * @param diagram 대상 문서
     * @param format export 포맷
     * @return export payload
     */
    public MarkdownExportResult export(Diagram diagram, String format) {
        if (!DiagramPluginId.MARKDOWN.value().equals(diagram.getPluginId())) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOCUMENT_PLUGIN_UNSUPPORTED.code());
        }

        final var content = diagram.getContent() == null ? "" : diagram.getContent();
        // 방어적 검증: DTO @Pattern과 별개로, 컨트롤러를 경유하지 않는 내부 호출에도 포맷 제약을 강제한다.
        if (!"md".equals(format)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOCUMENT_EXPORT_FORMAT_UNSUPPORTED.code());
        }

        return new MarkdownExportResult(
            "text/markdown; charset=UTF-8",
            sanitizeFilename(diagram.getName()) + ".md",
            content.getBytes(StandardCharsets.UTF_8)
        );
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9가-힣._-]+", "-").replaceAll("-{2,}", "-").replaceAll("^-|-$", "");
    }

    /**
     * markdown export payload.
     *
     * @param contentType 응답 content type
     * @param fileName 파일 이름
     * @param body 본문 바이트
     */
    public record MarkdownExportResult(String contentType, String fileName, byte[] body) {}
}
