package com.smarterd.domain.diagram.repository;

import org.springframework.lang.Nullable;

/**
 * 다이어그램 bootstrap 메타만 담는 경량 프로젝션.
 *
 * @param contentRevision  현재 content 리비전
 * @param snapshotRevision 현재 snapshot 리비전 (없으면 null)
 * @param hasYdocSnapshot  Y.Doc 스냅샷 존재 여부
 * @param artifactAvailable content fallback artifact 존재 여부
 */
public record DiagramBootstrapProjection(
    long contentRevision,
    @Nullable Long snapshotRevision,
    boolean hasYdocSnapshot,
    boolean artifactAvailable
) {}
