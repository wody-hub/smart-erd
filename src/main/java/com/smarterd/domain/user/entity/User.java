package com.smarterd.domain.user.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자 엔티티.
 *
 * <p>시스템에 가입한 사용자 정보를 나타내며, {@code loginId}를 고유 식별자로 사용하여 인증한다.
 * 비밀번호는 BCrypt로 해싱되어 저장된다.</p>
 */
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    /** 사용자 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 로그인 ID (고유, 최대 50자) */
    @Column(nullable = false, unique = true, length = 50)
    private String loginId;

    /** BCrypt로 해싱된 비밀번호 */
    @Column(nullable = false)
    private String password;

    /** 사용자 표시 이름 (최대 50자) */
    @Column(nullable = false, length = 50)
    private String name;

    /**
     * 사용자 엔티티를 생성한다.
     *
     * @param loginId  로그인 ID
     * @param password 해싱된 비밀번호
     * @param name     사용자 이름
     */
    @Builder
    public User(String loginId, String password, String name) {
        this.loginId = loginId;
        this.password = password;
        this.name = name;
    }
}
