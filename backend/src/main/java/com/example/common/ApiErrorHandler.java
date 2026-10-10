package com.example.common;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

/** Translates boundary failures without exposing SQL, passwords, stack traces or request bodies. */
@RestControllerAdvice
public class ApiErrorHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> domain(ApiException exception) {
        return ResponseEntity.status(exception.getStatus()).body(new ApiError(
            exception.getCode(), exception.getMessage(), exception.getField()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception) {
        var error = exception.getBindingResult().getFieldError();
        return ResponseEntity.badRequest().body(new ApiError(
            "400", "입력값을 확인해 주세요.", error == null ? null : error.getField()
        ));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> malformed(Exception exception) {
        return ResponseEntity.badRequest().body(new ApiError("400", "잘못된 요청입니다.", null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(413).body(new ApiError("FILE_TOO_LARGE", "사진은 2MB 이하만 가능합니다.", "file"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> status(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        return ResponseEntity.status(status).body(new ApiError(
            Integer.toString(status), "요청을 처리할 수 없습니다.", null
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception exception) {
        if (exception instanceof org.springframework.web.ErrorResponse error) {
            int status = error.getStatusCode().value();
            return ResponseEntity.status(status).body(new ApiError(
                Integer.toString(status), "요청을 처리할 수 없습니다.", null
            ));
        }
        return ResponseEntity.internalServerError().body(new ApiError("500", "요청 처리 중 오류가 발생했습니다.", null));
    }
}
