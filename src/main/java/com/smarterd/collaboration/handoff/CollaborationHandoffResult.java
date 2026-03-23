package com.smarterd.collaboration.handoff;

/**
 * 협업 handoff 스냅샷과 그 출처를 함께 표현하는 결과 모델.
 *
 * @param snapshot handoff에 사용할 전체 update 스냅샷
 * @param source   handoff 출처 (`warm`, `cached`, `db`)
 */
public record CollaborationHandoffResult(
    byte[] snapshot,
    String source
) {}
