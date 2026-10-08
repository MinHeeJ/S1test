package com.resumecraft.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

/** Credentials accepted only at the authentication boundary. */
public record LoginInput(
        @JsonDeserialize(using = AuthTextDeserializer.class) String email,
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
        @JsonDeserialize(using = AuthTextDeserializer.class) String password) {
    @Override
    public String toString() {
        return "LoginInput[credentials redacted]";
    }
}
