package com.resumecraft.photos;

import com.resumecraft.common.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Authenticated photo transport: JSON upload result and private, unmodified binary download. */
@RestController
@RequestMapping("/api/photos")
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Uses the session identity; the request cannot choose an owner or resume to mutate. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UploadedPhoto>> uploadPhoto(
        Authentication authentication,
        @RequestPart(value = "file", required = false) MultipartFile file
    ) {
        return ResponseEntity.status(201).body(ApiResponse.of(service.uploadPhoto(authentication.getName(), file)));
    }

    /** Returns the stored MIME and exact bytes, never a JSON envelope or server crop. */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPhoto(Authentication authentication, @PathVariable String id) {
        Photo photo = service.getPhoto(authentication.getName(), id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .cacheControl(CacheControl.noStore())
            .body(photo.data());
    }
}
