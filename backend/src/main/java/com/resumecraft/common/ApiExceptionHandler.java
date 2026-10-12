package com.resumecraft.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Converts transport and domain failures without leaking SQL, credentials, or stack traces. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> domain(ApiException error) {
        return ResponseEntity.status(error.status())
            .body(ApiError.of(error.code(), error.getMessage(), error.field()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldError();
        return ResponseEntity.badRequest().body(ApiError.of(
            "INVALID_REQUEST", "입력값을 확인해주세요.", field == null ? null : field.getField()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable() {
        return ResponseEntity.badRequest().body(ApiError.of("INVALID_REQUEST", "잘못된 요청입니다.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> oversized() {
        return ResponseEntity.status(413).body(ApiError.of("FILE_TOO_LARGE", "파일 크기가 너무 큽니다.", "file"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected() {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ApiError.of("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", null));
    }
}
