package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link TeamMember} 엔티티의 데이터 접근 레포지토리.
 *
 * <p>복합 기본키 {@link TeamMemberId}(팀 ID + 사용자 ID)를 사용한다.</p>
 */
public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMemberId> {
}
