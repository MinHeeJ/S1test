package com.resumecraft.resumes;

/** Initial title is optional, while the template is explicitly chosen by the caller. */
public record CreateResumeRequest(String title, String template) {}
