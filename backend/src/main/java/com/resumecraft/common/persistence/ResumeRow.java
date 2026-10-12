package com.resumecraft.common.persistence;

import java.time.OffsetDateTime;
import com.fasterxml.jackson.databind.JsonNode;

/** Database projection; not a public response DTO. */
public record ResumeRow(Long id, Long userId, String title, String template, JsonNode style, JsonNode content,
        boolean deleted, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
}
