package com.resumecraft.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** Shared JSON success envelope; binary and 204 responses must not use it. */
public record ApiResponse<T>(
    boolean success,
    Map<String, Object> meta,
    @JsonInclude(JsonInclude.Include.NON_NULL) T data
) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(true, Map.of(), data);
    }

    public static <T> ApiResponse<T> success(T data) {
        return of(data);
    }

    public static ApiResponse<Void> ok() {
        return of(null);
    }
}
