package com.resumecraft.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Translates application and input failures without leaking SQL, passwords or stack traces. */
@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> business(ApiException error) {
        return ResponseEntity.status(error.getStatus())
                .body(ApiError.of(error.getCode(), error.getMessage(), error.getField()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldError();
        return ResponseEntity.badRequest().body(ApiError.of(
                "INVALID_INPUT", "입력값을 확인해 주세요.", field == null ? null : field.getField()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> malformed(Exception error) {
        return ResponseEntity.badRequest().body(ApiError.of("INVALID_INPUT", "잘못된 요청입니다.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> oversized(Exception error) {
        return ResponseEntity.status(413).body(ApiError.of("FILE_TOO_LARGE", "파일 크기가 너무 큽니다.", null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error) {
        return ResponseEntity.internalServerError()
                .body(ApiError.of("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", null));
    }
}
