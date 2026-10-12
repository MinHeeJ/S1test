package com.resumecraft.resumes;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.persistence.ResumeRow;
import java.time.OffsetDateTime;

/** Public document projection excludes owner, deletion flags and account secrets. */
public record Resume(String id, String title, String template, JsonNode style, JsonNode content,
        @JsonProperty("updated_at") OffsetDateTime updatedAt) {
    public static Resume from(ResumeRow row) {
        return new Resume(row.id().toString(), row.title(), row.template(),
                row.style(), row.content(), row.updatedAt());
    }
}
