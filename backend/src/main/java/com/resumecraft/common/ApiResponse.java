package com.resumecraft.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** Shared success envelope; operations without a contracted result omit data. */
public record ApiResponse<T>(boolean success, Map<String, Object> meta,
        @JsonInclude(JsonInclude.Include.NON_NULL) T data) {
    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(true, Map.of(), null);
    }

    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(true, Map.of(), data);
    }
}
