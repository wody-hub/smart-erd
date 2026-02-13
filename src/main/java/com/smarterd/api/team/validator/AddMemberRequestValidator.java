package com.smarterd.api.team.validator;

import com.smarterd.api.team.dto.AddMemberRequest;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
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
    public boolean supports(@NonNull Class<?> clazz) {
        return AddMemberRequest.class.isAssignableFrom(clazz);
    }

    @Override
    public void validate(@NonNull Object target, @NonNull Errors errors) {
        final var request = (AddMemberRequest) target;

        if (request.loginId() != null && !userRepository.existsByLoginId(request.loginId())) {
            errors.rejectValue(
                "loginId",
                Objects.requireNonNull(MessageCode.ERROR_NOT_FOUND_USER.code()),
                new Object[] { request.loginId() },
                "User not found"
            );
        }
    }
}
