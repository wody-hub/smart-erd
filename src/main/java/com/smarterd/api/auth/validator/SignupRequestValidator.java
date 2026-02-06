package com.smarterd.api.auth.validator;

import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
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

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    @Override
    public boolean supports(@SuppressWarnings("null") Class<?> clazz) {
        return SignupRequest.class.isAssignableFrom(clazz);
    }

    @Override
    @SuppressWarnings("null")
    public void validate(Object target, Errors errors) {
        final var request = (SignupRequest) target;

        if (request.loginId() != null && userRepository.existsByLoginId(request.loginId())) {
            errors.rejectValue("loginId", "duplicate", "Login ID already exists: " + request.loginId());
        }
    }
}
