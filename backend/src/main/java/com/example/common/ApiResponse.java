package com.example.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** Success envelope; commands omit data rather than inventing a result payload. */
public class ApiResponse<T> {
    private final T data;

    public ApiResponse(T data) {
        this.data = data;
    }

    public boolean isSuccess() {
        return true;
    }

    public Map<String, Object> getMeta() {
        return Map.of();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public T getData() {
        return data;
    }

    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(data);
    }
}
