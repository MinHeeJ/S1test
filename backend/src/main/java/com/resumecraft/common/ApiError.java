package com.resumecraft.common;

import java.util.Map;

/** Stable top-level error fields; non-field errors retain an explicit null field. */
public record ApiError(boolean success, Map<String, Object> meta, String code, String message, String field) {
    public static ApiError of(String code, String message, String field) {
        return new ApiError(false, Map.of(), code, message, field);
    }
}
