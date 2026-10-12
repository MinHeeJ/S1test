package com.resumecraft.photos;

import com.resumecraft.common.ApiResponse;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Session-protected upload and original-image transport; ownership is enforced by the service and mapper. */
@RestController
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Upload returns only the new reference; resume linkage is a separate update operation. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PhotoUploadResult> uploadPhoto(Authentication actor, @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(new PhotoUploadResult(service.uploadPhoto(actor, file)));
    }

    /** Returns original bytes with their stored media type, never a public cacheable image. */
    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(Authentication actor, @PathVariable UUID id) {
        var photo = service.getPhoto(actor, id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .body(photo.data());
    }

    /** The upload contract exposes a UUID without persistence-only metadata. */
    public record PhotoUploadResult(UUID photoId) {
    }
}
