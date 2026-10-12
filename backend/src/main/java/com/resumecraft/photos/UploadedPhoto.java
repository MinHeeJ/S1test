package com.resumecraft.photos;

import java.util.UUID;

/** Identifier for a committed upload, connected by a separate resume save. */
public record UploadedPhoto(UUID photoId) {
}
