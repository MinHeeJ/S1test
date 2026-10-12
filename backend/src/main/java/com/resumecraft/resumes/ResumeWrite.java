package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Full editable snapshot; identity and lifecycle fields remain server controlled. */
public record ResumeWrite(String title, String template, JsonNode style, JsonNode content) {
}
