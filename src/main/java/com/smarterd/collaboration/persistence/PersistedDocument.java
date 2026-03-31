package com.smarterd.collaboration.persistence;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * persistence에 저장된 문서 표현.
 *
 * @param documentId 문서 ID
 * @param pluginId 플러그인 ID
 * @param engineId 엔진 ID
 * @param pluginSchemaVersion 플러그인 스키마 버전
 * @param snapshotFormatVersion 스냅샷 포맷 버전
 * @param artifactVersion 호환 artifact 버전
 * @param revision 저장된 revision
 * @param snapshot persistence 저장 스냅샷
 * @param compatibilityArtifact 호환 artifact
 */
public record PersistedDocument(
    @NonNull Long documentId,
    @NonNull String pluginId,
    @NonNull String engineId,
    int pluginSchemaVersion,
    int snapshotFormatVersion,
    @Nullable Integer artifactVersion,
    long revision,
    @NonNull byte[] snapshot,
    @Nullable byte[] compatibilityArtifact
) {
    /**
     * 기본 생성자.
     *
     * <p>배열 필드는 방어 복사하여 persisted 표현의 불변성을 유지한다.</p>
     */
    public PersistedDocument {
        snapshot = snapshot.clone();
        compatibilityArtifact = compatibilityArtifact != null ? compatibilityArtifact.clone() : null;
    }

    @Override
    public byte[] snapshot() {
        return snapshot.clone();
    }

    @Override
    public byte[] compatibilityArtifact() {
        return compatibilityArtifact != null ? compatibilityArtifact.clone() : null;
    }
}
