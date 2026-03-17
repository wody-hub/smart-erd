package com.smarterd.domain.diagram.repository;

import org.springframework.lang.Nullable;

/**
 * Y.Doc 스냅샷과 리비전 정보를 함께 반환하는 프로젝션 record.
 *
 * @param ydocSnapshot     Y.Doc 바이너리 스냅샷 (null 가능)
 * @param snapshotRevision snapshot 리비전 (null 가능)
 */
public record SnapshotWithRevision(@Nullable byte[] ydocSnapshot, @Nullable Long snapshotRevision) {}
