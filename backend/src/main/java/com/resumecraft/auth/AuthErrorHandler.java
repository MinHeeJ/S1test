package com.resumecraft.auth;

import com.resumecraft.common.ApiError;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Auth-specific malformed input uses the approved provisional code without changing other API errors. */
@Order(-1)
@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthErrorHandler {
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> malformed(HttpMessageNotReadableException error) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_STRUCTURE", "잘못된 요청입니다.", null));
    }
}
