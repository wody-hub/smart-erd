package com.smarterd.domain.markdown.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.entity.DiagramPluginId;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Objects;
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
    public record MarkdownExportResult(String contentType, String fileName, byte[] body) {
        public MarkdownExportResult {
            body = copy(body);
        }

        /**
         * markdown 본문 바이트를 방어 복사하여 반환한다.
         *
         * @return 본문 바이트 복사본
         */
        @Override
        public byte[] body() {
            return copy(body);
        }

        /**
         * 배열 내용을 포함해 동등성을 비교한다.
         *
         * @param other 비교 대상
         * @return 동등하면 {@code true}
         */
        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof MarkdownExportResult that)) {
                return false;
            }
            return (
                Objects.equals(contentType, that.contentType) &&
                Objects.equals(fileName, that.fileName) &&
                Arrays.equals(body, that.body)
            );
        }

        /**
         * 배열 내용을 포함한 hash code를 반환한다.
         *
         * @return hash code
         */
        @Override
        public int hashCode() {
            var result = Objects.hash(contentType, fileName);
            result = 31 * result + Arrays.hashCode(body);
            return result;
        }

        /**
         * byte 배열을 방어 복사한다.
         *
         * @param value 원본 배열
         * @return 복사본
         */
        private static byte[] copy(byte[] value) {
            return Arrays.copyOf(value, value.length);
        }
    }
}
