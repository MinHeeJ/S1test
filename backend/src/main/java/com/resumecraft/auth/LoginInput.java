package com.resumecraft.auth;

/** Login credentials are neither normalized nor subjected to signup length rules. */
public record LoginInput(String email, String password) {
}
