package com.resumecraft.photos;

import java.util.UUID;

/** Internal original-image projection; ownership and bytes are never serialized as JSON. */
public record Photo(UUID id, UUID userId, String contentType, byte[] data) {
}
