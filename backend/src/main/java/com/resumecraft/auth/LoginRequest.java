package com.resumecraft.auth;

/** Existing-account credentials, never serialized into a session or response. */
public record LoginRequest(String email, String password) {
}
