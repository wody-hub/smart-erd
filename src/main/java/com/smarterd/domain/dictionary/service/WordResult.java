package com.smarterd.domain.dictionary.service;

import java.time.Instant;

/**
 * 단어 응답용 서비스 결과.
 *
 * @param id 단어 ID
 * @param logicalName 논리명
 * @param physicalName 물리명
 * @param description 설명
 * @param teamId 소속 팀 ID
 * @param dictionarySetId 소속 사전 세트 ID
 * @param createdAt 생성 시각
 * @param updatedAt 수정 시각
 */
public record WordResult(
    Long id,
    String logicalName,
    String physicalName,
    String description,
    Long teamId,
    Long dictionarySetId,
    Instant createdAt,
    Instant updatedAt
) {}
