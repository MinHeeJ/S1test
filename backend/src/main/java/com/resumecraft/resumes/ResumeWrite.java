package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;

/** Full editor snapshot; required text values may remain empty while drafting. */
public record ResumeWrite(String title, String template, JsonNode style, JsonNode content) {}
