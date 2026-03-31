package com.smarterd.collaboration;

/**
 * 협업 기능 전반에서 공유하는 바이트/요청 상한.
 */
public final class CollaborationLimits {

    /**
     * 문서 snapshot 및 누적 update 최대 크기.
     */
    public static final int MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;

    private CollaborationLimits() {}
}
