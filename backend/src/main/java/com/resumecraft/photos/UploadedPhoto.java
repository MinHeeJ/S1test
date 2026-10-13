package com.resumecraft.photos;

/** Identifier returned after upload; linking it to a resume is a separate command. */
public record UploadedPhoto(String photoId) {
}
