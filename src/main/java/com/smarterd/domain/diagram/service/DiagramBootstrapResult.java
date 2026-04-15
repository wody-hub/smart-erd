package com.smarterd.domain.diagram.service;

/**
 * 다이어그램 bootstrap 응답용 서비스 결과.
 *
 * @param pluginId              문서 플러그인 ID
 * @param engineId              문서 엔진 ID
 * @param pluginSchemaVersion   플러그인 스키마 버전
 * @param snapshotFormatVersion 스냅샷 포맷 버전
 * @param artifactVersion       artifact 버전
 * @param revision              content 리비전
 * @param snapshotAvailable     Y.Doc 스냅샷 존재 여부
 * @param artifactAvailable     content fallback artifact 존재 여부
 */
public record DiagramBootstrapResult(
    String pluginId,
    String engineId,
    int pluginSchemaVersion,
    int snapshotFormatVersion,
    Integer artifactVersion,
    long revision,
    boolean snapshotAvailable,
    boolean artifactAvailable
) {}
