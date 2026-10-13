package com.resumecraft.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** Shared success envelope; a health response deliberately has no business data. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, Map<String, Object> meta, T data) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, Map.of(), data);
    }
}
