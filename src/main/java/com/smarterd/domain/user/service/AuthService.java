package com.smarterd.domain.user.service;

import com.smarterd.api.auth.dto.AuthResponse;
import com.smarterd.api.auth.dto.LoginRequest;
import com.smarterd.api.auth.dto.SignupRequest;
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
 * 회원가입 시 중복 확인 후 사용자를 생성한다.
 * 두 경우 모두 JWT 토큰을 발급하여 {@link AuthResponse}로 반환한다.</p>
 */
@Service
@RequiredArgsConstructor
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
     * <p>{@link AuthenticationManager}를 통해 로그인 ID와 비밀번호를 검증한 후,
     * JWT 토큰을 발급하여 반환한다.</p>
     *
     * @param request 로그인 요청 DTO
     * @return 인증 응답 (토큰, 로그인 ID, 이름)
     * @throws org.springframework.security.authentication.BadCredentialsException 자격 증명이 올바르지 않은 경우
     */
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.loginId(), request.password())
        );

        User user = userRepository.findByLoginId(request.loginId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String token = jwtTokenService.generateToken(user.getLoginId());
        return new AuthResponse(token, user.getLoginId(), user.getName());
    }

    /**
     * 신규 사용자 회원가입을 수행한다.
     *
     * <p>로그인 ID 중복 여부를 확인한 후, 비밀번호를 BCrypt로 해싱하여 사용자를 저장하고
     * JWT 토큰을 발급하여 반환한다.</p>
     *
     * @param request 회원가입 요청 DTO
     * @return 인증 응답 (토큰, 로그인 ID, 이름)
     * @throws IllegalArgumentException 로그인 ID가 이미 존재하는 경우
     */
    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByLoginId(request.loginId())) {
            throw new IllegalArgumentException("Login ID already exists");
        }

        User user = User.builder()
                .loginId(request.loginId())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .build();

        userRepository.save(user);

        String token = jwtTokenService.generateToken(user.getLoginId());
        return new AuthResponse(token, user.getLoginId(), user.getName());
    }
}
