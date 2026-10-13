package com.resumecraft.photos;

/** Persistence projection of the original image; timestamps remain database-owned. */
public record PhotoRow(String id, long userId, String contentType, byte[] data) {
}
