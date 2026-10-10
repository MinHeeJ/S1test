package com.example.auth;

import java.util.UUID;

/** Internal users-row mapping, never serialized as a public response or stored with hashes in a session. */
public class AuthUser {
    private UUID id;
    private String email;
    private String nickname;
    private String passwordHash;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
}
