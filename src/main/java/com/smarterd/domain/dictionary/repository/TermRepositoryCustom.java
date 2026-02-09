package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.team.entity.Team;
import java.util.List;

/**
 * {@link Term} QueryDSL 커스텀 쿼리 인터페이스.
 */
public interface TermRepositoryCustom {
    /**
     * 팀에 속한 모든 용어를 도메인과 함께 페치 조인하여 조회한다.
     *
     * <p>용어 목록 API에서 {@code term.getDomain()} 접근 시 N+1 쿼리를 방지하기 위해 사용한다.</p>
     *
     * @param team 팀 엔티티
     * @return 용어 목록 (도메인 페치 조인 완료)
     */
    List<Term> findByTeamWithDomain(Team team);
}
