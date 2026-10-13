package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Public snapshot; ownership and deletion metadata never leave the persistence boundary. */
public record Resume(
        String id, String title, String template, JsonNode style, JsonNode content, String updated_at
) {}
