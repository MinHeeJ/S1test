package com.resumecraft.common;

import java.util.Map;

/** Keeps field errors at the top level, including an explicit null for non-field failures. */
public record ApiError(boolean success, Map<String, Object> meta, String code, String message, String field) {
    public static ApiError of(String code, String message, String field) {
        return new ApiError(false, Map.of(), code, message, field);
    }
}
