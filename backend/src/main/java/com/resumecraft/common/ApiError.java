package com.resumecraft.common;

import java.util.Map;

/** 보안 및 업무 오류의 공개 응답. 내부 예외와 비밀 정보를 포함하지 않는다. */
public record ApiError(boolean success, Map<String, Object> meta, String code, String message, String field) {
    public static ApiError of(String code, String message, String field) {
        return new ApiError(false, Map.of(), code, message, field);
    }
}
