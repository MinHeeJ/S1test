package com.resumecraft.auth;

import java.util.UUID;
import com.resumecraft.common.SessionUser;

/** Internal users-row materialization; never serialized as an API result. */
public record AuthAccount(UUID id, String email, String nickname, String passwordHash) {
    public SessionUser sessionUser() {
        return new SessionUser(id, email, nickname);
    }

    @Override
    public String toString() {
        return "AuthAccount[credentials redacted]";
    }
}
