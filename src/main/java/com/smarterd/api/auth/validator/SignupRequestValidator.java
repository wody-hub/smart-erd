package com.smarterd.api.auth.validator;

import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.user.service.AuthService;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.validation.Errors;
import org.springframework.validation.Validator;

/**
 * 회원가입 요청 유효성 검사기.
 *
 * <p>어노테이션 기반 검증({@code @NotBlank}, {@code @Size}) 이후
 * DB 조회가 필요한 추가 검증을 수행한다.</p>
 *
 * <ul>
 *   <li>{@code loginId} 중복 확인</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class SignupRequestValidator implements Validator {

    /** 인증 서비스 */
    private final AuthService authService;

    @Override
    public boolean supports(@NonNull Class<?> clazz) {
        return SignupRequest.class.isAssignableFrom(clazz);
    }

    @Override
    public void validate(@NonNull Object target, @NonNull Errors errors) {
        final var request = (SignupRequest) target;

        if (request.loginId() != null && authService.existsByLoginId(request.loginId())) {
            errors.rejectValue(
                "loginId",
                Objects.requireNonNull(MessageCode.ERROR_DUPLICATE_LOGIN_ID.code()),
                new Object[] { request.loginId() },
                "Login ID already exists"
            );
        }
    }
}
