package com.resumecraft.common.persistence;

import java.time.OffsetDateTime;

/** Database projection; not a public response DTO. */
public record UserRow(Long id, String email, String nickname, String passwordHash,
        OffsetDateTime createdAt, OffsetDateTime updatedAt) {
}
