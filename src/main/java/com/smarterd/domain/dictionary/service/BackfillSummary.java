package com.smarterd.domain.dictionary.service;

/**
 * 백필 요약.
 *
 * @param structuredTypeUpdates 구조화 타입 보정 건수
 * @param ghContractUpdates GH 도급 메타데이터 보정 건수
 */
public record BackfillSummary(int structuredTypeUpdates, int ghContractUpdates) {}
