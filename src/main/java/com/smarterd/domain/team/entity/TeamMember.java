package com.smarterd.domain.team.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "team_members")
@IdClass(TeamMemberId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TeamMember extends BaseTimeEntity {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TeamMemberRole role;

    @Builder
    public TeamMember(Team team, User user, TeamMemberRole role) {
        this.team = team;
        this.user = user;
        this.role = role;
    }
}
