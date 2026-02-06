package com.smarterd.api.auth;

import com.smarterd.api.auth.dto.AuthResponse;
import com.smarterd.api.auth.dto.LoginRequest;
import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.domain.user.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 관련 REST 컨트롤러.
 *
 * <p>{@code /api/auth} 경로 하위에 로그인 및 회원가입 엔드포인트를 제공한다.
 * 이 경로는 Spring Security에서 인증 없이 접근이 허용된다.</p>
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /** 인증 비즈니스 로직 서비스 */
    private final AuthService authService;

    /**
     * 사용자 로그인을 처리한다.
     *
     * @param request 로그인 요청 (loginId, password)
     * @return 200 OK + AuthResponse (JWT 토큰 포함)
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * 신규 사용자 회원가입을 처리한다.
     *
     * @param request 회원가입 요청 (loginId, password, name)
     * @return 201 Created + AuthResponse (JWT 토큰 포함)
     */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }
}
