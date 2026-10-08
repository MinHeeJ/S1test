package com.resumecraft.auth;

/** 로그인 자격증명 입력. 가입 길이 규칙을 로그인에 추가하지 않는다. */
public record LoginInput(String email, String password) {
}
