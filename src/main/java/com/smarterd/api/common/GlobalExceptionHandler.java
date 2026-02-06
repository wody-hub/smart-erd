package com.smarterd.api.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * 전역 예외 처리기.
 *
 * <p>컨트롤러에서 발생하는 공통 예외를 잡아 적절한 HTTP 응답으로 변환한다.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 잘못된 인자 예외를 400 Bad Request로 반환한다.
     *
     * @param ex IllegalArgumentException
     * @return 400 + 에러 메시지
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", ex.getMessage()));
    }

    /**
     * 유효성 검증 실패를 400 Bad Request로 반환한다.
     *
     * @param ex MethodArgumentNotValidException
     * @return 400 + 첫 번째 필드 에러 메시지
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .orElse("Validation failed");
        return ResponseEntity.badRequest()
                .body(Map.of("error", message));
    }
}
