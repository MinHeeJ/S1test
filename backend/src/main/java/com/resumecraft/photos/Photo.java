package com.resumecraft.photos;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Stored original image; resume JSON references its identity without owning its lifecycle. */
public record Photo(UUID id, UUID userId, String contentType, byte[] data, OffsetDateTime createdAt) {
}
