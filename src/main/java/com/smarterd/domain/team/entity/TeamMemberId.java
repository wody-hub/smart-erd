package com.smarterd.domain.team.entity;

import java.io.Serializable;

/**
 * {@link TeamMember} 엔티티의 복합 기본키 레코드.
 *
 * <p>{@code team}(팀 ID)과 {@code user}(사용자 ID)를 조합하여 유일한 팀-멤버 관계를 식별한다.
 * JPA {@code @IdClass}와 함께 사용된다.</p>
 *
 * @param team 팀 ID
 * @param user 사용자 ID
 * @see TeamMember
 */
public record TeamMemberId(Long team, Long user) implements Serializable {}
