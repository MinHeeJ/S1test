package com.resumecraft.common;

import java.io.Serializable;
import java.security.Principal;
import java.util.UUID;

/** Stable session identity; never stores or serializes a password hash. */
public record SessionUser(UUID id, String email, String nickname) implements Principal, Serializable {
    @Override
    public String getName() {
        return id.toString();
    }
}
