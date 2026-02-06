package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Team} 엔티티의 데이터 접근 레포지토리.
 */
public interface TeamRepository extends JpaRepository<Team, Long> {}
