package com.smarterd.domain.team.repository;

import com.smarterd.domain.team.entity.Team;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

/**
 * {@link Team} 엔티티의 데이터 접근 레포지토리.
 */
public interface TeamRepository extends JpaRepository<Team, Long>, TeamRepositoryCustom {
    /**
     * 팀 엔티티를 비관적 쓰기 락으로 조회한다.
     *
     * <p>동일 팀 범위의 동시 수정 작업을 직렬화해야 하는 경로에서 사용한다.</p>
     *
     * @param id 팀 ID
     * @return 팀 엔티티 Optional
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Team t where t.id = :id")
    Optional<Team> findByIdForUpdate(@Param("id") Long id);
}
