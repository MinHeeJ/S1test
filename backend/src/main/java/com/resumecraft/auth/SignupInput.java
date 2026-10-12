package com.resumecraft.auth;

/** Account creation input; password confirmation stays in the UI. */
public record SignupInput(String email, String nickname, String password) {
}
