package com.resumecraft.common;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Translates application failures into safe contract errors, never database messages. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiError> domain(DomainException error) {
        return ResponseEntity.status(error.status())
                .body(ApiError.of(error.code(), error.getMessage(), error.field()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        var first = error.getBindingResult().getFieldError();
        return ResponseEntity.badRequest().body(ApiError.of(
                "400", "입력값을 확인해 주세요.", first == null ? null : first.getField()));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> malformed(Exception error) {
        return ResponseEntity.badRequest().body(ApiError.of("400", "잘못된 요청입니다.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> oversized(MaxUploadSizeExceededException error) {
        return ResponseEntity.status(413).body(ApiError.of("FILE_TOO_LARGE", "사진 크기가 너무 큽니다.", "file"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error) {
        return ResponseEntity.internalServerError().body(ApiError.of("500", "요청을 처리하지 못했습니다.", null));
    }
}
