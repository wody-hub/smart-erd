package com.smarterd.collaboration.document;

import org.springframework.lang.NonNull;

/**
 * 엔진 ID로 shared document engine을 조회하는 레지스트리 포트.
 */
public interface SharedDocumentEngineRegistry {
    /**
     * 엔진 ID에 해당하는 shared document engine을 반환한다.
     *
     * @param engineId 엔진 ID
     * @return shared document engine
     */
    @NonNull
    SharedDocumentEngine require(@NonNull String engineId);
}
