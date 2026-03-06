package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;

/**
 * 다이어그램과 Y.Doc 스냅샷 존재 여부를 함께 반환하는 record.
 *
 * @param diagram        다이어그램 엔티티
 * @param hasYdocSnapshot Y.Doc 스냅샷 존재 여부 (ydocSnapshot IS NOT NULL)
 */
public record DiagramWithSnapshotFlag(Diagram diagram, boolean hasYdocSnapshot) {}
