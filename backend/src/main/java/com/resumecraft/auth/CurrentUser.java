package com.resumecraft.auth;

/** The contracted public session projection intentionally excludes identity and credentials. */
public record CurrentUser(String nickname) {}
