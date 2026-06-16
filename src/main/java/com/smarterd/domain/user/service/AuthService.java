package com.smarterd.domain.user.service;

import com.smarterd.config.security.AuthSecurityProperties;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.exception.TooManyRequestsException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 비즈니스 로직 서비스.
 *
 * <p>로그인 시 {@link AuthenticationManager}를 통해 자격 증명을 검증하고,
 * 회원가입 시 사용자를 생성한다.
 * 두 경우 모두 Access Token과 Refresh Token을 발급하여 {@link AuthResult}로 반환한다.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class AuthService {

    /** Spring Security 인증 관리자 */
    private final AuthenticationManager authenticationManager;

    /** JWT 토큰 생성 서비스 */
    private final JwtTokenService jwtTokenService;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;
    /** 인증 보안 프로퍼티 */
    private final AuthSecurityProperties authSecurityProperties;

    /** 비밀번호 인코더 */
    private final PasswordEncoder passwordEncoder;
    /** 로그인 실패 기반 Rate Limiting 서비스 */
    private final LoginRateLimitService loginRateLimitService;

    /**
     * 사용자 로그인을 수행한다.
     *
     * @param command 로그인 명령
     * @return 인증 응답 (Access Token, Refresh Token, 로그인 ID, 이름)
     */
    @Transactional
    public AuthResult login(AuthLoginCommand command) {
        if (authSecurityProperties.getTestSupport().isSkipPasswordVerification()) {
            loginRateLimitService.reset(command.loginId(), command.clientIp());
            return issueTokens(findUserByLoginId(command.loginId()));
        }

        if (loginRateLimitService.isBlocked(command.loginId(), command.clientIp())) {
            throw new TooManyRequestsException(MessageCode.ERROR_AUTH_LOGIN_RATE_LIMITED.code());
        }

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(command.loginId(), command.password())
            );
        } catch (AuthenticationException e) {
            try {
                loginRateLimitService.recordFailure(command.loginId(), command.clientIp());
            } catch (RuntimeException rateLimitException) {
                // rate-limit 기록 실패가 인증 실패 응답을 500으로 바꾸지 않도록 방어한다.
                log.warn("Failed to record login rate-limit state. loginId={}", command.loginId(), rateLimitException);
            }
            throw e;
        }

        loginRateLimitService.reset(command.loginId(), command.clientIp());

        final var user = findUserByLoginId(command.loginId());
        return issueTokens(user);
    }

    /**
     * 신규 사용자 회원가입을 수행한다.
     *
     * @param command 회원가입 명령
     * @return 인증 응답 (Access Token, Refresh Token, 로그인 ID, 이름)
     */
    @Transactional
    public AuthResult signup(AuthSignupCommand command) {
        if (existsByLoginId(command.loginId())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_LOGIN_ID.code(), command.loginId());
        }

        final var user = User.builder()
            .loginId(command.loginId())
            .password(passwordEncoder.encode(command.password()))
            .name(command.name())
            .build();
        user.initializeAuditActor(command.loginId());

        userRepository.save(Objects.requireNonNull(user));

        return issueTokens(user);
    }

    /**
     * Refresh Token으로 새로운 Access Token과 Refresh Token을 발급한다 (토큰 회전).
     *
     * @param command Refresh Token 명령
     * @return 새로운 인증 응답
     */
    @Transactional
    public AuthResult refresh(AuthRefreshTokenCommand command) {
        final var refreshToken = jwtTokenService.validateRefreshTokenForRefresh(command.refreshToken());
        final var user = refreshToken.getUser();

        jwtTokenService.consumeRefreshToken(refreshToken);

        return issueTokens(user);
    }

    /**
     * 로그아웃 시 해당 Refresh Token을 삭제한다.
     *
     * @param command Refresh Token 명령
     */
    @Transactional
    public void logout(AuthRefreshTokenCommand command) {
        final var refreshToken = jwtTokenService.validateRefreshTokenForLogout(command.refreshToken());
        jwtTokenService.deleteRefreshToken(refreshToken);
    }

    /**
     * 로그인 ID로 사용자를 조회한다.
     *
     * @param loginId 로그인 ID
     * @return 사용자 엔티티
     * @throws EntityNotFoundException 사용자가 존재하지 않는 경우
     */
    public User findUserByLoginId(String loginId) {
        return userRepository
            .findByLoginId(loginId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), loginId));
    }

    /**
     * Checks whether a login id is already registered.
     *
     * @param loginId login id
     * @return true when the login id already exists
     */
    public boolean existsByLoginId(String loginId) {
        return userRepository.existsByLoginId(loginId);
    }

    /**
     * Access Token과 Refresh Token을 함께 발급한다.
     *
     * @param user 대상 사용자
     * @return 인증 응답
     */
    private AuthResult issueTokens(User user) {
        final var accessToken = jwtTokenService.generateAccessToken(user.getLoginId());
        final var refreshToken = jwtTokenService.createRefreshToken(user);
        return new AuthResult(accessToken, refreshToken, user.getLoginId(), user.getName());
    }
}
