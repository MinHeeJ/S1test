package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Validated full replacement of editable fields; identity and ownership are server controlled. */
public record ResumeWrite(String title, String template, JsonNode style, JsonNode content) {
}
