package com.example.auth;

/** Registration input; password confirmation belongs only to the screen. */
public class SignupInput extends LoginInput {
    private String nickname;

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }
}
