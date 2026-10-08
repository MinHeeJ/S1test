package com.resumecraft.common;

import java.util.Map;

/** Flat contract error; field is null when no single input can be identified. */
public record ApiError(boolean success, Map<String, Object> meta, String code, String message, String field) {
    public static ApiError of(String code, String message, String field) {
        return new ApiError(false, Map.of(), code, message, field);
    }
}
