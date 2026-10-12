package com.resumecraft.resumes;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Public resume projection excludes owner, deletion state and any calculated completion score. */
public record ResumeRecord(
    UUID id,
    String title,
    String template,
    JsonNode style,
    JsonNode content,
    @JsonProperty("updated_at") OffsetDateTime updatedAt
) {
}
