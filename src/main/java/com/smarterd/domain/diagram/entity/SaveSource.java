package com.smarterd.domain.diagram.entity;

/**
 * 다이어그램 콘텐츠 저장 원본 구분.
 *
 * <p>저장 원본에 따라 snapshot 유효성 처리 전략이 달라진다.</p>
 */
public enum SaveSource {
    /** Yjs 자동 백업 — snapshot 유지, contentRevision만 증가 */
    YJS_BACKUP,
    /** 비-Yjs 저장 (REST 직접 저장 등) — snapshot + snapshotRevision 무효화 */
    NON_YJS_UPDATE,
}
