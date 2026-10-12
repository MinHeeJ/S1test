package com.resumecraft.common;

import java.util.Map;

/** Successful JSON envelope; bodyless and binary operations must not use it. */
public record ApiResponse<T>(
    boolean success,
    Map<String, Object> meta,
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) T data
) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(true, Map.of(), data);
    }
}
