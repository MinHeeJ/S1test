package com.resumecraft.common;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

/** Minimal authenticated identity shared by owner-scoped services; no password is retained. */
public record SessionUser(UUID id, String email, String nickname) implements Principal, Serializable {
    @Override
    public String getName() {
        return id.toString();
    }
}
