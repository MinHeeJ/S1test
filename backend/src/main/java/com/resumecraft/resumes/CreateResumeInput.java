package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Keeps input token types intact instead of coercing numeric titles to strings. */
public record CreateResumeInput(JsonNode title, JsonNode template) {
}
