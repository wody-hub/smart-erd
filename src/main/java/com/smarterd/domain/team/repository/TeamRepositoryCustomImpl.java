package com.smarterd.domain.team.repository;

import static com.smarterd.domain.team.entity.QTeam.team;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.team.entity.Team;
import java.util.Optional;
import lombok.RequiredArgsConstructor;

/**
 * {@link TeamRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class TeamRepositoryCustomImpl implements TeamRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Team> findByIdWithOwner(Long id) {
        var result = queryFactory.selectFrom(team).join(team.owner).fetchJoin().where(team.id.eq(id)).fetchOne();
        return Optional.ofNullable(result);
    }
}
