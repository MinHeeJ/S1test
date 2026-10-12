package com.resumecraft.common.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Database projection; not a public response DTO. */
public record PhotoRow(UUID id, Long userId, String contentType, byte[] data, OffsetDateTime createdAt) {
}
