package com.smarterd.api.auth.dto;

import com.smarterd.domain.user.service.AuthSignupCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청 DTO.
 *
 * @param loginId  로그인 ID (필수, 2~50자)
 * @param password 비밀번호 (필수, 8~100자)
 * @param name     사용자 이름 (필수, 1~50자)
 */
@Schema(description = "회원가입 요청")
public record SignupRequest(
    @Schema(description = "로그인 ID (2~50자)", example = "hong")
    @NotBlank(message = "{validation.not-blank.login-id}")
    @Size(min = 2, max = 50, message = "{validation.size.login-id}")
    String loginId,

    @Schema(description = "비밀번호 (8~100자)", example = "password123")
    @NotBlank(message = "{validation.not-blank.password}")
    @Size(min = 8, max = 100, message = "{validation.size.password}")
    String password,

    @Schema(description = "사용자 이름 (1~50자)", example = "홍길동")
    @NotBlank(message = "{validation.not-blank.name}")
    @Size(min = 1, max = 50, message = "{validation.size.name}")
    String name
) {
    /**
     * Converts this REST request into the domain signup command.
     *
     * @return domain signup command
     */
    public AuthSignupCommand toCommand() {
        return new AuthSignupCommand(loginId, password, name);
    }
}
