package com.resumecraft.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Translates boundary failures without leaking SQL, submitted values or stack traces. */
@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> business(ApiException error) {
        return ResponseEntity.status(error.status())
                .body(ApiError.of(error.code(), error.getMessage(), error.field()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException error) {
        var field = error.getBindingResult().getFieldErrors().stream()
                .map(value -> value.getField()).sorted().findFirst().orElse(null);
        return ResponseEntity.badRequest().body(ApiError.of("400", "입력값을 확인해 주세요.", field));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestPartException.class})
    public ResponseEntity<ApiError> malformed(Exception error) {
        return ResponseEntity.badRequest().body(ApiError.of("400", "입력값을 확인해 주세요.", null));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> missing() {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiError.of("404", "찾을 수 없습니다.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> tooLarge() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiError.of("FILE_TOO_LARGE", "파일 크기 제한을 초과했습니다.", "file"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error) {
        return ResponseEntity.internalServerError().body(ApiError.of("500", "요청을 처리하지 못했습니다.", null));
    }
}
