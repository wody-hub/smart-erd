package com.smarterd.domain.user.repository;

import com.smarterd.domain.user.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link User} 엔티티의 데이터 접근 레포지토리.
 *
 * <p>Spring Data JPA가 런타임에 구현체를 자동 생성하며, 로그인 ID 기반 조회 메서드를 제공한다.</p>
 */
public interface UserRepository extends JpaRepository<User, Long> {
    /**
     * 로그인 ID로 사용자를 조회한다.
     *
     * @param loginId 로그인 ID
     * @return 사용자 Optional (존재하지 않으면 empty)
     */
    Optional<User> findByLoginId(String loginId);

    /**
     * 해당 로그인 ID가 이미 존재하는지 확인한다.
     *
     * @param loginId 로그인 ID
     * @return 존재하면 {@code true}
     */
    boolean existsByLoginId(String loginId);
}
