package com.smarterd.domain.team.repository;

import static com.smarterd.domain.team.entity.QTeamMember.teamMember;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * {@link TeamMemberRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class TeamMemberRepositoryCustomImpl implements TeamMemberRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<TeamMember> findByUserWithTeamAndOwner(User user) {
        return queryFactory
            .selectFrom(teamMember)
            .join(teamMember.team)
            .fetchJoin()
            .join(teamMember.team.owner)
            .fetchJoin()
            .where(teamMember.user.eq(user))
            .fetch();
    }
}
