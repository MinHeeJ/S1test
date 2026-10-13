package com.resumecraft.resumes;

import java.time.OffsetDateTime;

/** PostgreSQL projection retains JSON strings and timestamps until public snapshot conversion. */
public record ResumeRow(
        Long id, Long userId, String title, String template, String style, String content,
        Boolean deleted, OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
