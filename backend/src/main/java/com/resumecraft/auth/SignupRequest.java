package com.resumecraft.auth;

/** Signup wire input; password confirmation stays entirely in the browser. */
public record SignupRequest(String email, String nickname, String password) {
}
