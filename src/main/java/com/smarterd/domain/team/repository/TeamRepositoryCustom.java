package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.Team;
import java.util.Optional;

/**
 * {@link Team} QueryDSL 커스텀 쿼리 인터페이스.
 */
public interface TeamRepositoryCustom {
    /**
     * 팀 ID로 팀을 조회하면서 소유자를 함께 페치 조인한다.
     *
     * <p>owner가 LAZY이므로 N+1 방지를 위해 사용한다.</p>
     *
     * @param id 팀 ID
     * @return 팀 Optional (owner 페치 조인 완료)
     */
    Optional<Team> findByIdWithOwner(Long id);
}
