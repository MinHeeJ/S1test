package com.resumecraft.auth;

/** JSON credentials; never returned or logged. */
public record LoginInput(String email, String password) {
}
