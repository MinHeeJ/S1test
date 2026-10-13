package com.resumecraft.auth;

/** Internal account materialization; credential hashes never leave the service boundary. */
public record UserRow(Long id, String email, String nickname, String passwordHash) {
}
