package com.resumecraft.photos;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionAuthentication;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Authenticated photo transport; original image responses do not use a JSON envelope. */
@RestController
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Upload does not mutate resume.content: that is a separate owner-checked PUT. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<PhotoUploadResult>> uploadPhoto(
            Authentication authentication,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        UUID id = service.upload(SessionAuthentication.userId(authentication), file);
        return ResponseEntity.status(201).body(ApiResponse.ok(new PhotoUploadResult(id)));
    }

    /** No public cache may retain user-private image bytes after session changes. */
    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(Authentication authentication, @PathVariable UUID id) {
        var row = service.get(SessionAuthentication.userId(authentication), id);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(row.contentType()))
                .body(row.data());
    }

    /** The only declared upload result is the generated photo identifier. */
    public record PhotoUploadResult(UUID photoId) {
    }
}
