package com.resumecraft.resumes;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

/** Read-only projection of an active resume; ownership and deletion are never exposed as writable fields. */
public record ResumeDocument(UUID id, String title, String template, JsonNode style, JsonNode content,
        @JsonProperty("updated_at") String updatedAt) {
}
