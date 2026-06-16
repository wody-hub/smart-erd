package com.smarterd.domain.diagram.service;

/**
 * 서버 종료 시 snapshot flush 결과.
 *
 * @param hasFlushTargets flush 대상 존재 여부
 * @param savedCount 저장 성공 수
 */
record DiagramSnapshotShutdownFlushResult(boolean hasFlushTargets, int savedCount) {}
