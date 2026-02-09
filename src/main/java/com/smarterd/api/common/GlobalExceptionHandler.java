package com.smarterd.api.common;

import com.smarterd.domain.common.exception.AccessDeniedException;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 전역 예외 처리기.
 *
 * <p>컨트롤러에서 발생하는 공통 예외를 잡아 적절한 HTTP 응답으로 변환한다.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 엔티티 미존재 예외를 404 Not Found로 반환한다.
     *
     * @param ex 엔티티 미존재 예외
     * @return 404 응답
     */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleEntityNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    /**
     * 권한 부족 예외를 403 Forbidden으로 반환한다.
     *
     * @param ex 권한 부족 예외
     * @return 403 응답
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    /**
     * 중복 리소스 예외를 409 Conflict로 반환한다.
     *
     * @param ex 중복 리소스 예외
     * @return 409 응답
     */
    @ExceptionHandler(DuplicateException.class)
    public ResponseEntity<Map<String, String>> handleDuplicate(DuplicateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    /**
     * 비즈니스 규칙 위반 예외를 400 Bad Request로 반환한다.
     *
     * @param ex 비즈니스 규칙 위반 예외
     * @return 400 응답
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Map<String, String>> handleBusiness(BusinessException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    /**
     * 유효성 검증 실패를 400 Bad Request로 반환한다.
     *
     * @param ex 유효성 검증 예외
     * @return 400 응답 (첫 번째 필드 에러 메시지)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex
            .getBindingResult()
            .getFieldErrors()
            .stream()
            .findFirst()
            .map((e) -> e.getField() + ": " + e.getDefaultMessage())
            .orElse("Validation failed");
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    /**
     * 위 핸들러에서 잡히지 않은 예상치 못한 예외를 500 Internal Server Error로 반환한다.
     *
     * <p>내부 구현 정보(스택 트레이스, 클래스명 등)가 클라이언트에 노출되지 않도록
     * 일반적인 메시지만 반환하고, 실제 예외는 서버 로그에 기록한다.</p>
     *
     * @param ex 예상치 못한 예외
     * @return 500 응답 (일반 메시지)
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            Map.of("error", "An unexpected error occurred")
        );
    }
}
