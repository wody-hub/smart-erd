package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMemberId> {
}
