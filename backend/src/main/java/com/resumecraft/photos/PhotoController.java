package com.resumecraft.photos;

import com.resumecraft.common.ApiResponse;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Session-protected transport for original photo upload and owner-only binary retrieval. */
@RestController
@RequestMapping("/api/photos")
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Creates a photo, not a resume connection; the client receives its UUID after commit. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UploadedPhoto>> uploadPhoto(
            @RequestPart(value = "file", required = false) MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(service.upload(file)));
    }

    /** Returns raw bytes with the stored MIME and prevents private photos from being cached. */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPhoto(@PathVariable UUID id) {
        PhotoRecord photo = service.get(id);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .body(photo.data());
    }
}
