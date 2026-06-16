package com.smarterd.collaboration.persistence;

import java.util.Arrays;
import java.util.Objects;
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
        snapshot = Objects.requireNonNull(snapshot, "snapshot must not be null").clone();
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

    /**
     * 배열 필드를 내용 기준으로 비교한다.
     *
     * @param value 비교 대상
     * @return 값 동등 여부
     */
    @Override
    public boolean equals(Object value) {
        if (this == value) {
            return true;
        }
        if (!(value instanceof PersistedDocument other)) {
            return false;
        }
        return (
            pluginSchemaVersion == other.pluginSchemaVersion &&
            snapshotFormatVersion == other.snapshotFormatVersion &&
            revision == other.revision &&
            Objects.equals(documentId, other.documentId) &&
            Objects.equals(pluginId, other.pluginId) &&
            Objects.equals(engineId, other.engineId) &&
            Objects.equals(artifactVersion, other.artifactVersion) &&
            Arrays.equals(snapshot, other.snapshot) &&
            Arrays.equals(compatibilityArtifact, other.compatibilityArtifact)
        );
    }

    /**
     * 배열 필드를 내용 기준으로 해시한다.
     *
     * @return hash code
     */
    @Override
    public int hashCode() {
        var result = Objects.hash(
            documentId,
            pluginId,
            engineId,
            pluginSchemaVersion,
            snapshotFormatVersion,
            artifactVersion,
            revision
        );
        result = 31 * result + Arrays.hashCode(snapshot);
        result = 31 * result + Arrays.hashCode(compatibilityArtifact);
        return result;
    }
}
