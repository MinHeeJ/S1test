package com.example.common;

import java.util.Map;

/** Flat error contract retaining the single nullable field and excluding internal exception details. */
public class ApiError {
    private final String code;
    private final String message;
    private final String field;

    public ApiError(String code, String message, String field) {
        this.code = code;
        this.message = message;
        this.field = field;
    }

    public boolean isSuccess() {
        return false;
    }

    public Map<String, Object> getMeta() {
        return Map.of();
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public String getField() {
        return field;
    }
}
