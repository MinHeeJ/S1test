package com.resumecraft.auth;

/** 가입 JSON 입력. 비밀번호 확인은 UI-only이며 저장 row를 직접 전송하지 않는다. */
public record SignupInput(String email, String nickname, String password) {
}
