package com.resumecraft.auth;

import java.util.UUID;

/** Persistence-only account projection; never serialized as an HTTP response. */
public record AuthAccount(UUID id, String email, String nickname, String passwordHash) {
    @Override
    public String toString() {
        return "AuthAccount[redacted]";
    }
}
