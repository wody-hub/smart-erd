package com.smarterd.domain.user.service;

import com.smarterd.api.auth.dto.AuthResponse;
import com.smarterd.api.auth.dto.LoginRequest;
import com.smarterd.api.auth.dto.RefreshRequest;
import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 비즈니스 로직 서비스.
 *
 * <p>로그인 시 {@link AuthenticationManager}를 통해 자격 증명을 검증하고,
 * 회원가입 시 사용자를 생성한다.
 * 두 경우 모두 Access Token과 Refresh Token을 발급하여 {@link AuthResponse}로 반환한다.</p>
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AuthService {

    /** Spring Security 인증 관리자 */
    private final AuthenticationManager authenticationManager;

    /** JWT 토큰 생성 서비스 */
    private final JwtTokenService jwtTokenService;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /** 비밀번호 인코더 */
    private final PasswordEncoder passwordEncoder;

    /**
     * 사용자 로그인을 수행한다.
     *
     * @param request 로그인 요청 DTO
     * @return 인증 응답 (Access Token, Refresh Token, 로그인 ID, 이름)
     */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.loginId(), request.password())
        );

        final var user = findUserByLoginId(request.loginId());
        return issueTokens(user);
    }

    /**
     * 신규 사용자 회원가입을 수행한다.
     *
     * @param request 회원가입 요청 DTO
     * @return 인증 응답 (Access Token, Refresh Token, 로그인 ID, 이름)
     */
    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByLoginId(request.loginId())) {
            throw new DuplicateException("Login ID already exists: " + request.loginId());
        }

        final var user = User.builder()
            .loginId(request.loginId())
            .password(passwordEncoder.encode(request.password()))
            .name(request.name())
            .build();

        userRepository.save(user);

        return issueTokens(user);
    }

    /**
     * Refresh Token으로 새로운 Access Token과 Refresh Token을 발급한다 (토큰 회전).
     *
     * @param request Refresh Token 요청 DTO
     * @return 새로운 인증 응답
     */
    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        final var refreshToken = jwtTokenService.validateRefreshToken(request.refreshToken());
        final var user = refreshToken.getUser();

        jwtTokenService.deleteRefreshToken(refreshToken);

        return issueTokens(user);
    }

    /**
     * 로그아웃 시 해당 Refresh Token을 삭제한다.
     *
     * @param request Refresh Token 요청 DTO
     */
    @Transactional
    public void logout(RefreshRequest request) {
        final var refreshToken = jwtTokenService.validateRefreshToken(request.refreshToken());
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
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + loginId));
    }

    /**
     * Access Token과 Refresh Token을 함께 발급한다.
     *
     * @param user 대상 사용자
     * @return 인증 응답
     */
    private AuthResponse issueTokens(User user) {
        final var accessToken = jwtTokenService.generateAccessToken(user.getLoginId());
        final var refreshToken = jwtTokenService.createRefreshToken(user);
        return new AuthResponse(accessToken, refreshToken, user.getLoginId(), user.getName());
    }
}
