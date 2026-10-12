package com.resumecraft.auth;

import jakarta.validation.constraints.NotNull;

/** Login only requires the two credential strings; signup length rules do not apply. */
public record LoginRequest(@NotNull String email, @NotNull String password) {
}
