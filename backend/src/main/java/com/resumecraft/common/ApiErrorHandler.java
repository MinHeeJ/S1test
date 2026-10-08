package com.resumecraft.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Translates known input errors and conceals all unexpected internal failures. */
@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> business(ApiException exception) {
        return ResponseEntity.status(exception.status())
            .body(ApiError.of(exception.code(), exception.getMessage(), exception.field()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        var error = exception.getBindingResult().getFieldError();
        return standard(HttpStatus.BAD_REQUEST, error == null ? null : error.getField());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> input(Exception exception) {
        return standard(HttpStatus.BAD_REQUEST, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> upload(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(ApiError.of("FILE_TOO_LARGE", "사진 크기는 2MB 이하여야 합니다.", "file"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> status(ResponseStatusException exception) {
        return standard(HttpStatus.valueOf(exception.getStatusCode().value()), null);
    }

    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiError> missing(Exception exception) {
        return standard(HttpStatus.NOT_FOUND, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception exception) {
        return standard(HttpStatus.INTERNAL_SERVER_ERROR, null);
    }

    private ResponseEntity<ApiError> standard(HttpStatus status, String field) {
        return ResponseEntity.status(status)
            .body(ApiError.of(status.getReasonPhrase(), status.getReasonPhrase(), field));
    }
}
