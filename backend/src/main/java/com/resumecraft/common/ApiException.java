package com.resumecraft.common;

import org.springframework.http.HttpStatus;

/** 업무 서비스가 지정된 HTTP 상태와 안전한 사용자 메시지를 전달하는 예외. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String field;

    public ApiException(HttpStatus status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String field() {
        return field;
    }
}
