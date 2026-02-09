package com.smarterd.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Refresh Token 엔티티.
 *
 * <p>사용자별 Refresh Token을 DB에 저장하여 토큰 회전 및 무효화를 지원한다.
 * 토큰 값은 UUID이며, 만료 시각과 함께 관리된다.</p>
 */
@Entity
@Table(
    name = "refresh_tokens",
    indexes = { @Index(name = "idx_refresh_token_token", columnList = "token", unique = true) }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

    /** 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 토큰 소유 사용자 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** UUID 기반 토큰 값 */
    @Column(nullable = false, unique = true)
    private String token;

    /** 토큰 만료 시각 */
    @Column(nullable = false)
    private Instant expiresAt;

    /**
     * Refresh Token을 생성한다.
     *
     * @param user      토큰 소유 사용자
     * @param token     UUID 토큰 문자열
     * @param expiresAt 만료 시각
     */
    public RefreshToken(User user, String token, Instant expiresAt) {
        this.user = user;
        this.token = token;
        this.expiresAt = expiresAt;
    }
}
