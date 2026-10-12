package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Whole-document save preserves JSON omissions and excludes the separately renamed title. */
public record UpdateResumeInput(JsonNode template, JsonNode style, JsonNode content) {
}
