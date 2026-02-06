package com.smarterd.domain.team.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * {@link TeamMember} 엔티티의 복합 기본키 클래스.
 *
 * <p>{@code team}(팀 ID)과 {@code user}(사용자 ID)를 조합하여 유일한 팀-멤버 관계를 식별한다.
 * JPA {@code @IdClass}와 함께 사용된다.</p>
 *
 * @see TeamMember
 */
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class TeamMemberId implements Serializable {

    /** 팀 ID */
    private Long team;

    /** 사용자 ID */
    private Long user;
}
