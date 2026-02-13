package com.smarterd.domain.user.service;

import com.smarterd.config.JwtProperties;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.user.entity.RefreshToken;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.RefreshTokenRepository;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * JWT 토큰 및 Refresh Token 관리 서비스.
 *
 * <p>Access Token은 Spring Security의 {@link JwtEncoder}로 HS256 JWT를 발급하고,
 * Refresh Token은 UUID로 생성하여 DB에 저장한다.
 * 토큰 회전 전략을 적용하여 갱신 시 이전 RT를 삭제하고 새로운 RT를 발급한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class JwtTokenService {

    /** JWT 인코더 */
    private final JwtEncoder jwtEncoder;

    /** JWT 설정 프로퍼티 */
    private final JwtProperties jwtProperties;

    /** Refresh Token 레포지토리 */
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * 지정된 로그인 ID에 대한 JWT Access Token을 생성한다.
     *
     * @param loginId 토큰 subject에 저장할 로그인 ID
     * @return 서명된 JWT Access Token 문자열
     */
    public String generateAccessToken(String loginId) {
        final var now = Instant.now();
        final var header = JwsHeader.with(MacAlgorithm.HS256).build();
        final var claims = JwtClaimsSet.builder()
            .subject(loginId)
            .issuedAt(now)
            .expiresAt(now.plusMillis(jwtProperties.getAccessExpiration()))
            .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /**
     * 사용자에 대한 Refresh Token을 생성하고 DB에 저장한다.
     *
     * @param user 토큰 소유 사용자
     * @return UUID 기반 Refresh Token 문자열
     */
    @Transactional
    public String createRefreshToken(User user) {
        final var token = UUID.randomUUID().toString();
        final var expiresAt = Instant.now().plusMillis(jwtProperties.getRefreshExpiration());
        final var refreshToken = new RefreshToken(user, token, expiresAt);
        refreshTokenRepository.save(refreshToken);
        return token;
    }

    /**
     * Refresh Token을 검증하고 해당 엔티티를 반환한다.
     *
     * @param token Refresh Token 문자열
     * @return 유효한 RefreshToken 엔티티
     * @throws BusinessException 토큰이 존재하지 않거나 만료된 경우
     */
    @Transactional
    public RefreshToken validateRefreshToken(String token) {
        final var refreshToken = refreshTokenRepository
            .findByToken(token)
            .orElseThrow(() -> new BusinessException(MessageCode.ERROR_BUSINESS_REFRESH_TOKEN_INVALID.code()));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BusinessException(MessageCode.ERROR_BUSINESS_REFRESH_TOKEN_EXPIRED.code());
        }

        return refreshToken;
    }

    /**
     * 특정 Refresh Token을 삭제한다.
     *
     * @param refreshToken 삭제할 Refresh Token 엔티티
     */
    @Transactional
    public void deleteRefreshToken(RefreshToken refreshToken) {
        refreshTokenRepository.delete(Objects.requireNonNull(refreshToken));
    }
}
