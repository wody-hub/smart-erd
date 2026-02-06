package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberId;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link TeamMember} 엔티티의 데이터 접근 레포지토리.
 *
 * <p>복합 기본키 {@link TeamMemberId}(팀 ID + 사용자 ID)를 사용한다.</p>
 */
public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMemberId> {
    /**
     * 특정 사용자가 속한 모든 팀 멤버십을 조회한다.
     *
     * @param user 사용자
     * @return 팀 멤버 목록
     */
    List<TeamMember> findByUser(User user);

    /**
     * 특정 팀의 모든 멤버를 조회한다.
     *
     * @param team 팀
     * @return 팀 멤버 목록
     */
    List<TeamMember> findByTeam(Team team);

    /**
     * 특정 팀-사용자 멤버십이 존재하는지 확인한다.
     *
     * @param team 팀
     * @param user 사용자
     * @return 존재하면 {@code true}
     */
    boolean existsByTeamAndUser(Team team, User user);

    /**
     * 특정 팀-사용자 멤버십을 조회한다.
     *
     * @param team 팀
     * @param user 사용자
     * @return 팀 멤버 Optional
     */
    Optional<TeamMember> findByTeamAndUser(Team team, User user);
}
