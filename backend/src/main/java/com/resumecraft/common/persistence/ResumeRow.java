package com.resumecraft.common.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Internal persistence projection; never return password hashes or ownership fields as an API DTO. */
public record ResumeRow(
    UUID id,
    UUID userId,
    String title,
    String template,
    JsonNode style,
    JsonNode content,
    boolean deleted,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
