package com.resumecraft.common;

import org.springframework.http.HttpStatus;

/** Carries a safe domain rejection without exposing persistence or credential details. */
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
