package com.smarterd.domain.diagram.repository;

import java.time.Instant;

/**
 * 문서 허브 목록용 경량 프로젝션.
 *
 * <p>content, ydoc_snapshot 컬럼을 제외하여 목록 조회 시 불필요한 대용량 데이터 로딩을 방지한다.</p>
 *
 * @param id                다이어그램 ID
 * @param name              다이어그램 이름
 * @param pluginId          문서 플러그인 ID
 * @param dictionarySetId   사전 세트 ID (markdown 문서는 null)
 * @param dictionarySetName 사전 세트 이름 (markdown 문서는 null)
 * @param templateKey       markdown 템플릿 키 (ERD 문서는 null)
 * @param summaryText       markdown 본문 요약 텍스트 (ERD 문서는 null, 첫 저장 전 markdown도 null 가능)
 * @param createdAt         생성 시각
 * @param updatedAt         수정 시각
 */
public record DiagramSummaryProjection(
    Long id,
    String name,
    String pluginId,
    Long dictionarySetId,
    String dictionarySetName,
    String templateKey,
    String summaryText,
    Instant createdAt,
    Instant updatedAt
) {}
