package com.resumecraft.common;

import java.util.Map;

/** Minimal success envelope for operations that declare no data. */
public record ApiResponse(boolean success, Map<String, Object> meta) {
    public static ApiResponse ok() {
        return new ApiResponse(true, Map.of());
    }

    /** Only use this envelope when the operation explicitly declares data. */
    public static <T> Data<T> data(T value) {
        return new Data<>(true, Map.of(), value);
    }

    public record Data<T>(boolean success, Map<String, Object> meta, T data) {
    }
}
