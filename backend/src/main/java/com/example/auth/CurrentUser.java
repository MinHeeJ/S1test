package com.example.auth;

/** Minimal public user projection: identity and password hashes never leave the session boundary. */
public class CurrentUser {
    private final String nickname;

    public CurrentUser(String nickname) {
        this.nickname = nickname;
    }

    public String getNickname() {
        return nickname;
    }
}
