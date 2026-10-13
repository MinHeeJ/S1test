package com.resumecraft.auth;

/** Minimal public account projection required by the authenticated header. */
public record CurrentUser(String nickname) {
}
