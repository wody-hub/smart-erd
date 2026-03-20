package com.smarterd.domain.diagram.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.utils.AppStringUtils;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 content 내 사전 바인딩(termId/domainId) 무효화 서비스.
 *
 * <p>
 * 사전 세트 변경 시, 대상 세트에 존재하지 않는 term/domain 바인딩을
 * 다이어그램 JSON content에서 제거한다.
 * </p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramDictionaryBindingService {

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** JSON 파서 */
    private final ObjectMapper objectMapper;

    /**
     * 다이어그램 content의 term/domain 바인딩을 대상 세트 기준으로 정리한다.
     *
     * <p>세트에 존재하지 않는 termId/domainId는 제거한다.</p>
     *
     * @param diagram   대상 다이어그램
     * @param targetSet 변경 대상 사전 세트
     * @return 무효화 카운트
     */
    @Transactional
    public InvalidationCounts invalidateBindings(Diagram diagram, DictionarySet targetSet) {
        final var content = diagram.getContent();
        if (AppStringUtils.isBlank(content)) {
            return InvalidationCounts.empty();
        }

        final Set<Long> validTermIds = termRepository
            .findByDictionarySet(targetSet)
            .stream()
            .map(Term::getId)
            .collect(Collectors.toSet());
        final Set<Long> validDomainIds = domainRepository
            .findByDictionarySet(targetSet)
            .stream()
            .map(Domain::getId)
            .collect(Collectors.toSet());

        try {
            final var rootNode = objectMapper.readTree(content);
            if (!(rootNode instanceof ObjectNode rootObject)) {
                return InvalidationCounts.empty();
            }

            final var counts = invalidateRootAndNodes(rootObject, validTermIds, validDomainIds);

            if (counts.invalidatedTermBindingCount() > 0 || counts.invalidatedDomainBindingCount() > 0) {
                diagram.updateContent(objectMapper.writeValueAsString(rootObject));
            }
            return counts;
        } catch (JsonProcessingException e) {
            log.warn("Failed to invalidate dictionary bindings for diagramId={}", diagram.getId(), e);
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        }
    }

    /**
     * 루트 객체와 노드 배열의 바인딩을 무효화한다.
     *
     * @param rootObject    JSON 루트 객체
     * @param validTermIds  유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateRootAndNodes(
        ObjectNode rootObject,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        final var tableTermId = toLongValue(rootObject.path("tableTermId"));
        if (tableTermId != null && !validTermIds.contains(tableTermId)) {
            rootObject.remove("tableTermId");
            invalidatedTermBindingCount++;
        }

        final var nodesNode = rootObject.get("nodes");
        if (nodesNode instanceof ArrayNode nodesArray) {
            for (final var node : nodesArray) {
                if (!(node instanceof ObjectNode nodeObject)) {
                    continue;
                }
                final var nodeCounts = invalidateNodeBindings(nodeObject, validTermIds, validDomainIds);
                invalidatedTermBindingCount += nodeCounts.invalidatedTermBindingCount();
                invalidatedDomainBindingCount += nodeCounts.invalidatedDomainBindingCount();
            }
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    /**
     * 개별 노드의 data 객체에서 term/domain 바인딩을 무효화한다.
     *
     * @param nodeObject     노드 JSON 객체
     * @param validTermIds   유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateNodeBindings(
        ObjectNode nodeObject,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        final var dataNode = nodeObject.get("data");
        if (!(dataNode instanceof ObjectNode dataObject)) {
            return InvalidationCounts.empty();
        }

        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        final var tableTermId = toLongValue(dataObject.get("tableTermId"));
        if (tableTermId != null && !validTermIds.contains(tableTermId)) {
            dataObject.remove("tableTermId");
            invalidatedTermBindingCount++;
        }

        final var columnsNode = dataObject.get("columns");
        if (columnsNode instanceof ArrayNode columnsArray) {
            final var columnCounts = invalidateColumnBindings(columnsArray, validTermIds, validDomainIds);
            invalidatedTermBindingCount += columnCounts.invalidatedTermBindingCount();
            invalidatedDomainBindingCount += columnCounts.invalidatedDomainBindingCount();
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    /**
     * 컬럼 배열에서 term/domain 바인딩을 무효화한다.
     *
     * @param columnsArray   컬럼 JSON 배열
     * @param validTermIds   유효한 용어 ID 집합
     * @param validDomainIds 유효한 도메인 ID 집합
     * @return 무효화 카운트
     */
    private InvalidationCounts invalidateColumnBindings(
        ArrayNode columnsArray,
        Set<Long> validTermIds,
        Set<Long> validDomainIds
    ) {
        var invalidatedTermBindingCount = 0;
        var invalidatedDomainBindingCount = 0;

        for (final var columnNode : columnsArray) {
            if (!(columnNode instanceof ObjectNode columnObject)) {
                continue;
            }

            final var termId = toLongValue(columnObject.get("termId"));
            if (termId != null && !validTermIds.contains(termId)) {
                columnObject.remove("termId");
                invalidatedTermBindingCount++;
            }

            final var domainId = toLongValue(columnObject.get("domainId"));
            if (domainId != null && !validDomainIds.contains(domainId)) {
                columnObject.remove("domainId");
                invalidatedDomainBindingCount++;
            }
        }

        return new InvalidationCounts(invalidatedTermBindingCount, invalidatedDomainBindingCount);
    }

    /**
     * JsonNode를 Long 값으로 변환한다.
     *
     * @param valueNode 변환할 JSON 노드
     * @return Long 값 (변환 불가 시 null)
     */
    @Nullable
    private Long toLongValue(JsonNode valueNode) {
        if (valueNode == null || valueNode.isNull()) {
            return null;
        }
        if (valueNode.canConvertToLong()) {
            return valueNode.longValue();
        }
        if (valueNode.isTextual()) {
            try {
                return Long.parseLong(valueNode.textValue());
            } catch (NumberFormatException e) {
                log.trace("텍스트를 Long으로 변환 불가: '{}'", valueNode.textValue(), e);
                return null;
            }
        }
        return null;
    }

    /**
     * 사전 바인딩 무효화 결과 카운트.
     *
     * @param invalidatedTermBindingCount   무효화된 용어 바인딩 수
     * @param invalidatedDomainBindingCount 무효화된 도메인 바인딩 수
     */
    public record InvalidationCounts(int invalidatedTermBindingCount, int invalidatedDomainBindingCount) {

        /**
         * 무효화 없음을 나타내는 빈 카운트를 반환한다.
         *
         * @return 빈 카운트
         */
        public static InvalidationCounts empty() {
            return new InvalidationCounts(0, 0);
        }
    }
}
