package com.resumecraft.common.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Internal persistence projection; never return password hashes or ownership fields as an API DTO. */
public record UserRow(
    UUID id,
    String email,
    String nickname,
    String passwordHash,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
