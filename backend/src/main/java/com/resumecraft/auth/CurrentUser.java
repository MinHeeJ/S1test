package com.resumecraft.auth;

/** The header needs only a nickname, not credentials or internal identity. */
public record CurrentUser(String nickname) {
}
