package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.user.entity.User;
import java.util.List;

/**
 * {@link TeamMember} QueryDSL 커스텀 쿼리 인터페이스.
 */
public interface TeamMemberRepositoryCustom {
    /**
     * 특정 사용자가 속한 모든 팀 멤버십을 팀·소유자와 함께 페치 조인하여 조회한다.
     *
     * <p>팀 목록 API에서 N+1 쿼리를 방지하기 위해 사용한다.</p>
     *
     * @param user 사용자
     * @return 팀 멤버 목록 (팀 + 소유자 페치 조인 완료)
     */
    List<TeamMember> findByUserWithTeamAndOwner(User user);
}
