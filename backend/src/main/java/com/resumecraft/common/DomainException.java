package com.resumecraft.common;

import org.springframework.http.HttpStatus;

/** Carries a safe, deliberate domain error without exposing persistence or credential details. */
public class DomainException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String field;

    public DomainException(HttpStatus status, String code, String message, String field) {
        super(message);
        this.status = status;
        this.code = code;
        this.field = field;
    }

    public DomainException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
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

    public static DomainException notFound() {
        return new DomainException(HttpStatus.NOT_FOUND, "NOT_FOUND", "자료를 찾을 수 없습니다.");
    }
}
