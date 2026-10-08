package com.resumecraft.auth;

/** Signup wire fields only; confirmation belongs to the browser. */
public record SignupInput(String email, String nickname, String password) {
}
