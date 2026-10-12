package com.resumecraft.auth;

import java.util.UUID;

/** Internal persistence projection; password hashes never cross the HTTP boundary. */
public record AuthAccount(UUID id, String email, String nickname, String passwordHash) {
}
