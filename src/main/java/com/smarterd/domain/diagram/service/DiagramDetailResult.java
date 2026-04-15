package com.smarterd.domain.diagram.service;

import java.time.Instant;

/**
 * 다이어그램 상세 응답용 서비스 결과.
 *
 * @param id                다이어그램 ID
 * @param name              다이어그램 이름
 * @param pluginId          문서 플러그인 ID
 * @param projectId         소속 프로젝트 ID
 * @param dictionarySetId   사전 세트 ID
 * @param dictionarySetName 사전 세트 이름
 * @param templateKey       템플릿 키
 * @param templateLabel     템플릿 표시 이름
 * @param summaryText       본문 요약 텍스트
 * @param content           직렬화된 React Flow JSON
 * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
 * @param contentRevision   content 리비전
 * @param snapshotRevision  snapshot 리비전
 * @param snapshotUpdatedAt snapshot 저장 시각
 * @param createdAt         생성 시각
 * @param updatedAt         수정 시각
 */
public record DiagramDetailResult(
    Long id,
    String name,
    String pluginId,
    Long projectId,
    Long dictionarySetId,
    String dictionarySetName,
    String templateKey,
    String templateLabel,
    String summaryText,
    String content,
    boolean hasYdocSnapshot,
    long contentRevision,
    Long snapshotRevision,
    Instant snapshotUpdatedAt,
    Instant createdAt,
    Instant updatedAt
) {}
