package com.resumecraft.common;

import java.util.Map;

/** Stable public error envelope without internal exception details. */
public record ApiError(boolean success, Map<String, Object> meta, String code, String message, String field) {
    public static ApiError of(String code, String message, String field) {
        return new ApiError(false, Map.of(), code, message, field);
    }
}
