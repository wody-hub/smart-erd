package com.smarterd.collaboration.persistence;

import org.springframework.lang.Nullable;

/**
 * persistence 계층이 제공하는 bootstrap header.
 *
 * @param pluginSchemaVersion 플러그인 스키마 버전
 * @param snapshotFormatVersion 스냅샷 포맷 버전
 * @param artifactVersion 호환 artifact 버전
 * @param revision 저장된 revision
 * @param snapshotAvailable 스냅샷 존재 여부
 * @param artifactAvailable artifact 존재 여부
 */
public record DocumentBootstrapHeader(
    int pluginSchemaVersion,
    int snapshotFormatVersion,
    @Nullable Integer artifactVersion,
    long revision,
    boolean snapshotAvailable,
    boolean artifactAvailable
) {}
