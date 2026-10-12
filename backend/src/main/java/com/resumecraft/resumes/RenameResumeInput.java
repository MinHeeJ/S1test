package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Title-only mutation; ownership and lifecycle values cannot be supplied. */
public record RenameResumeInput(JsonNode title) {
}
