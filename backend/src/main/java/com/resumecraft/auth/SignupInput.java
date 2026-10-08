package com.resumecraft.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

/** Signup wire fields; confirmation belongs only to the browser. */
public record SignupInput(
        @JsonDeserialize(using = AuthTextDeserializer.class) String email,
        @JsonDeserialize(using = AuthTextDeserializer.class) String nickname,
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
        @JsonDeserialize(using = AuthTextDeserializer.class) String password) {
    @Override
    public String toString() {
        return "SignupInput[credentials redacted]";
    }
}
