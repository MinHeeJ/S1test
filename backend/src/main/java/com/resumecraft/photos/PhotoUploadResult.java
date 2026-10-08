package com.resumecraft.photos;

import java.util.UUID;

/** Only the reference needed by the editor is exposed, never ownership or storage fields. */
public record PhotoUploadResult(UUID photoId) {
}
