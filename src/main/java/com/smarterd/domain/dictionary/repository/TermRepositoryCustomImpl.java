package com.smarterd.domain.dictionary.repository;

import static com.smarterd.domain.dictionary.entity.QTerm.term;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.team.entity.Team;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * {@link TermRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class TermRepositoryCustomImpl implements TermRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Term> findByDictionarySetWithDomain(DictionarySet dictionarySet) {
        return queryFactory
            .selectFrom(term)
            .leftJoin(term.domain)
            .fetchJoin()
            .where(term.dictionarySet.eq(dictionarySet))
            .fetch();
    }

    @Override
    public List<Term> findByTeamWithDomain(Team team) {
        return queryFactory.selectFrom(term).leftJoin(term.domain).fetchJoin().where(term.team.eq(team)).fetch();
    }
}
