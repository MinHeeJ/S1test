package com.resumecraft.photos;

import java.util.UUID;

/** Typed binary read model; ownership is enforced by the mapper predicate. */
public record PhotoRecord(UUID id, UUID userId, String contentType, byte[] data) {
}
