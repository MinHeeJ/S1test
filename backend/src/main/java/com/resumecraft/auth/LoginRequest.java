package com.resumecraft.auth;

import jakarta.validation.constraints.NotNull;

/** Credentials are required strings; signup-only length rules are not applied to login. */
public record LoginRequest(@NotNull String email, @NotNull String password) {
}
