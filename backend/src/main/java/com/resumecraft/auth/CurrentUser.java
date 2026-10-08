package com.resumecraft.auth;

/** 현재 사용자 공개 투영. 식별자와 이메일 및 비밀번호 해시는 노출하지 않는다. */
public record CurrentUser(String nickname) {
}
