package com.smarterd.domain.team.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 팀-사용자 간 다대다 관계를 나타내는 조인 엔티티.
 *
 * <p>{@code team_id}와 {@code user_id}를 복합 기본키({@link TeamMemberId})로 사용하며,
 * 각 구성원에게 {@link TeamMemberRole}을 부여한다.</p>
 *
 * @see TeamMemberId
 * @see TeamMemberRole
 */
@Entity
@Table(name = "team_members")
@IdClass(TeamMemberId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TeamMember extends BaseTimeEntity {

    /** 소속 팀 (복합 PK 구성 요소) */
    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    /** 소속 사용자 (복합 PK 구성 요소) */
    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /** 팀 내 역할 (ADMIN, MEMBER, VIEWER) */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TeamMemberRole role;

    /**
     * 팀 구성원 엔티티를 생성한다.
     *
     * @param team 소속 팀
     * @param user 소속 사용자
     * @param role 팀 내 역할
     */
    @Builder
    public TeamMember(Team team, User user, TeamMemberRole role) {
        this.team = team;
        this.user = user;
        this.role = role;
    }
}
