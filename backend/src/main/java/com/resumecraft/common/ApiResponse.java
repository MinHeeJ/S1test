package com.resumecraft.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** 성공 envelope. 약속된 결과가 없는 명령은 data를 직렬화하지 않는다. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, Map<String, Object> meta, T data) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, Map.of(), data);
    }

    public static ApiResponse<Void> ok() {
        return ok(null);
    }
}
