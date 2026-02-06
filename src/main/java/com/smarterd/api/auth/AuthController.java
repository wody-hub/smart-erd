package com.smarterd.api.auth;

import com.smarterd.api.auth.dto.AuthResponse;
import com.smarterd.api.auth.dto.LoginRequest;
import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.api.auth.validator.SignupRequestValidator;
import com.smarterd.domain.user.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.InitBinder;
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
@Tag(name = "Auth", description = "인증 API (로그인 · 회원가입)")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /** 인증 비즈니스 로직 서비스 */
    private final AuthService authService;

    /** 회원가입 요청 유효성 검사기 */
    private final SignupRequestValidator signupRequestValidator;

    /**
     * 커스텀 Validator를 등록한다.
     *
     * @param binder 웹 데이터 바인더
     */
    @InitBinder
    public void initBinder(WebDataBinder binder) {
        binder.addValidators(signupRequestValidator);
    }

    /**
     * 사용자 로그인을 처리한다.
     *
     * @param request 로그인 요청 (loginId, password)
     * @return 200 OK + AuthResponse (JWT 토큰 포함)
     */
    @Operation(summary = "로그인", description = "로그인 ID와 비밀번호로 인증하여 JWT 토큰을 발급한다.")
    @ApiResponse(
        responseCode = "200",
        description = "로그인 성공",
        content = @Content(schema = @Schema(implementation = AuthResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청 (유효성 검증 실패)", content = @Content)
    @ApiResponse(responseCode = "401", description = "인증 실패 (잘못된 자격 증명)", content = @Content)
    @SecurityRequirements
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
    @Operation(summary = "회원가입", description = "신규 사용자를 등록하고 JWT 토큰을 발급한다.")
    @ApiResponse(
        responseCode = "201",
        description = "회원가입 성공",
        content = @Content(schema = @Schema(implementation = AuthResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "잘못된 요청 (유효성 검증 실패 또는 중복 ID)", content = @Content)
    @SecurityRequirements
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
    }
}
