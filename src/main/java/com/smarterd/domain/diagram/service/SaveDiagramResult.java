package com.smarterd.domain.diagram.service;

import java.time.Instant;

/**
 * 다이어그램 저장 응답용 서비스 결과.
 *
 * @param contentRevision   최신 content 리비전
 * @param hasYdocSnapshot   Y.Doc 스냅샷 존재 여부
 * @param snapshotRevision  snapshot 리비전
 * @param snapshotUpdatedAt snapshot 저장 시각
 * @param updatedAt         최종 수정 시각
 */
public record SaveDiagramResult(
    long contentRevision,
    boolean hasYdocSnapshot,
    Long snapshotRevision,
    Instant snapshotUpdatedAt,
    Instant updatedAt
) {}
