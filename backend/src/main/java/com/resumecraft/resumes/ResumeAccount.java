package com.resumecraft.resumes;

/** Account projection for ownership and initial content, without credential material. */
public record ResumeAccount(Long id, String email, String nickname) {}
