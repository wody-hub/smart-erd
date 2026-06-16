package com.smarterd.domain.project.service;

import java.time.Instant;

/**
 * 프로젝트 응답용 서비스 결과.
 *
 * @param id 프로젝트 ID
 * @param name 프로젝트 이름
 * @param description 프로젝트 설명
 * @param teamId 팀 ID
 * @param createdAt 생성 시각
 * @param updatedAt 수정 시각
 */
public record ProjectResult(
    Long id,
    String name,
    String description,
    Long teamId,
    Instant createdAt,
    Instant updatedAt
) {}
