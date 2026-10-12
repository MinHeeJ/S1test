package com.resumecraft.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/** Translates transport and intentional domain failures to the public error contract. */
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiError> domain(DomainException exception) {
        return ResponseEntity.status(exception.status())
            .body(ApiError.of(exception.code(), exception.getMessage(), exception.field()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        var error = exception.getBindingResult().getFieldErrors().stream().findFirst();
        return ResponseEntity.badRequest().body(ApiError.of(
            "INVALID_INPUT", "입력값을 확인해 주세요.", error.map(e -> e.getField()).orElse(null)));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> malformed(Exception exception) {
        return ResponseEntity.badRequest().body(ApiError.of("INVALID_INPUT", "입력값을 확인해 주세요.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> uploadLimit(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(ApiError.of("FILE_TOO_LARGE", "파일 크기를 확인해 주세요.", "file"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception exception) {
        // Raw SQL, hashes, submitted content and exception messages never enter the public response.
        return ResponseEntity.internalServerError()
            .body(ApiError.of("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", null));
    }
}
