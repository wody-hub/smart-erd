package com.smarterd.api.team.validator;

import com.smarterd.api.team.dto.AddMemberRequest;
import com.smarterd.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.validation.Errors;
import org.springframework.validation.Validator;

/**
 * 멤버 추가 요청 유효성 검사기.
 *
 * <p>어노테이션 기반 검증({@code @NotBlank}, {@code @NotNull}) 이후
 * DB 조회가 필요한 추가 검증을 수행한다.</p>
 *
 * <ul>
 *   <li>{@code loginId} 존재 여부 확인</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class AddMemberRequestValidator implements Validator {

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    @Override
    public boolean supports(@SuppressWarnings("null") Class<?> clazz) {
        return AddMemberRequest.class.isAssignableFrom(clazz);
    }

    @Override
    @SuppressWarnings("null")
    public void validate(Object target, Errors errors) {
        final var request = (AddMemberRequest) target;

        if (request.loginId() != null && !userRepository.existsByLoginId(request.loginId())) {
            errors.rejectValue("loginId", "notFound", "User not found: " + request.loginId());
        }
    }
}
