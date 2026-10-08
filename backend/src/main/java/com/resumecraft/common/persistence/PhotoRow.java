package com.resumecraft.common.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Internal persistence projection; never return password hashes or ownership fields as an API DTO. */
public record PhotoRow(
    UUID id,
    UUID userId,
    String contentType,
    byte[] data,
    OffsetDateTime createdAt
) {
}
