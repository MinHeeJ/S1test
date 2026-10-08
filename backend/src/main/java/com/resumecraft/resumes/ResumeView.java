package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.persistence.ResumeRow;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Public saved-resume projection excludes ownership and logical deletion internals. */
public record ResumeView(UUID id, String title, String template, JsonNode style,
        JsonNode content, OffsetDateTime updated_at) {
    public static ResumeView from(ResumeRow row) {
        return new ResumeView(row.id(), row.title(), row.template(), row.style(), row.content(), row.updatedAt());
    }
}
