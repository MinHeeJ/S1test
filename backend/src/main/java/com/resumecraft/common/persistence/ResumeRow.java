package com.resumecraft.common.persistence;

import java.util.UUID;
import java.time.Instant;
import com.fasterxml.jackson.databind.JsonNode;

/** DB 전용 저장 row. HTTP에 소유자, 삭제 표시 또는 비밀 정보를 직접 직렬화하지 않는다. */
public record ResumeRow(
        UUID id,
        UUID userId,
        String title,
        String template,
        JsonNode style,
        JsonNode content,
        boolean deleted,
        Instant createdAt,
        Instant updatedAt) {
}
