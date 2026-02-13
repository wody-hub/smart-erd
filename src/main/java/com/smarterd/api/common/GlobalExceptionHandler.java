package com.smarterd.api.common;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.ConflictException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.exception.LocalizedException;
import com.smarterd.domain.common.message.MessageCode;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 전역 예외 처리기.
 *
 * <p>컨트롤러에서 발생하는 공통 예외를 잡아 적절한 HTTP 응답으로 변환한다.
 * {@link MessageSource}를 통해 요청 로케일에 맞는 다국어 에러 메시지를 반환한다.</p>
 */
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 다국어 메시지 소스 */
    private final MessageSource messageSource;

    /**
     * {@link LocalizedException} 하위 예외를 처리하여 다국어 에러 메시지를 반환한다.
     *
     * @param ex     다국어 예외
     * @param locale 요청 로케일
     * @return 적절한 HTTP 상태 + 다국어 에러 메시지
     */
    @ExceptionHandler(LocalizedException.class)
    public ResponseEntity<Map<String, String>> handleLocalizedException(LocalizedException ex, Locale locale) {
        final var message = messageSource.getMessage(
            Objects.requireNonNull(ex.getMessageCode()),
            ex.getMessageArgs(),
            locale
        );
        return ResponseEntity.status(Objects.requireNonNull(resolveStatus(ex))).body(Map.of("error", message));
    }

    /**
     * 유효성 검증 실패를 400 Bad Request로 반환한다.
     *
     * <p>Bean Validation이 {@link MessageSource}를 통해 이미 로케일에 맞게 번역한 메시지를 사용한다.</p>
     *
     * @param ex 유효성 검증 예외
     * @return 400 응답 (첫 번째 필드 에러 메시지)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex, Locale locale) {
        String message = ex
            .getBindingResult()
            .getFieldErrors()
            .stream()
            .findFirst()
            .map((e) -> e.getField() + ": " + messageSource.getMessage(e, locale))
            .orElse("Validation failed");
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    /**
     * 인증 실패 예외를 401 Unauthorized로 반환한다.
     *
     * <p>로그인 시 잘못된 자격 증명(BadCredentialsException 포함)으로 발생한
     * {@link AuthenticationException}을 처리한다.</p>
     *
     * @param locale 요청 로케일
     * @return 401 응답 (다국어 인증 실패 메시지)
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthenticationException(Locale locale) {
        final var message = messageSource.getMessage(
            Objects.requireNonNull(MessageCode.ERROR_AUTH_BAD_CREDENTIALS.code()),
            null,
            locale
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", message));
    }

    /**
     * 위 핸들러에서 잡히지 않은 예상치 못한 예외를 500 Internal Server Error로 반환한다.
     *
     * <p>내부 구현 정보(스택 트레이스, 클래스명 등)가 클라이언트에 노출되지 않도록
     * 일반적인 메시지만 반환하고, 실제 예외는 서버 로그에 기록한다.</p>
     *
     * @param ex     예상치 못한 예외
     * @param locale 요청 로케일
     * @return 500 응답 (다국어 일반 메시지)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex, Locale locale) {
        log.error("Unexpected error", ex);
        final var message = messageSource.getMessage(
            Objects.requireNonNull(MessageCode.ERROR_UNEXPECTED.code()),
            null,
            locale
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", message));
    }

    /**
     * 예외 타입에 따라 HTTP 상태 코드를 결정한다.
     *
     * @param ex 다국어 예외
     * @return HTTP 상태 코드
     */
    private HttpStatus resolveStatus(LocalizedException ex) {
        return switch (ex) {
            case EntityNotFoundException _ -> HttpStatus.NOT_FOUND;
            case DomainAccessDeniedException _ -> HttpStatus.FORBIDDEN;
            case DuplicateException _ -> HttpStatus.CONFLICT;
            case ConflictException _ -> HttpStatus.CONFLICT;
            case BusinessException _ -> HttpStatus.BAD_REQUEST;
            default -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
