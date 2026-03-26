package com.smarterd.collaboration.metadata;

import java.util.Set;
import org.springframework.lang.NonNull;

/**
 * 문서 bootstrap과 접근 제어에 필요한 최소 메타데이터.
 *
 * @param documentId 문서 ID
 * @param pluginId 문서 플러그인 ID
 * @param engineId shared document engine ID
 * @param ownerId 문서 소유자 식별자
 * @param memberIds 문서 접근 가능 멤버 식별자 목록
 */
public record DocumentMetadata(
    @NonNull Long documentId,
    @NonNull String pluginId,
    @NonNull String engineId,
    @NonNull String ownerId,
    @NonNull Set<String> memberIds
) {}
