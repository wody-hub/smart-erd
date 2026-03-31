package com.smarterd.collaboration.document;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * runtime에서 persistence로 내려가는 checkpoint 기록.
 *
 * @param documentId 문서 ID
 * @param pluginId 플러그인 ID
 * @param engineId 엔진 ID
 * @param pluginSchemaVersion 플러그인 스키마 버전
 * @param snapshotFormatVersion 스냅샷 포맷 버전
 * @param artifactVersion 호환 artifact 버전
 * @param revision 저장 대상 revision
 * @param snapshot persistence용 스냅샷
 * @param compatibilityArtifact 호환 artifact
 */
public record DocumentCheckpoint(
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
     * <p>배열 필드는 방어 복사하여 경계 객체의 불변성을 유지한다.</p>
     */
    public DocumentCheckpoint {
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
