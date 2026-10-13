package com.resumecraft.resumes;

/** A title-only command cannot change document content or style. */
public record RenameResumeRequest(String title) {}
