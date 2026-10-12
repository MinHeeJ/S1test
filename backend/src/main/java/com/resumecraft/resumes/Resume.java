package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Persisted resume projection; never exposes its owner's identity or deletion metadata. */
public record Resume(UUID id, String title, String template, JsonNode style, JsonNode content,
    @JsonProperty("updated_at") OffsetDateTime updatedAt) {
}
