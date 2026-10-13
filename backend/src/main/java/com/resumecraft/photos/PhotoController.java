package com.resumecraft.photos;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.DomainException;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Photo transport boundary; session identity, never multipart input, determines ownership. */
@RestController
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Stores one validated image and returns its UUID without modifying any resume. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<UploadedPhoto>> uploadPhoto(
            Authentication actor,
            @RequestParam(value = "file", required = false) MultipartFile file
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.uploadPhoto(owner(actor), file)));
    }

    /** Delivers original bytes only to the owner, with private content excluded from caches. */
    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(Authentication actor, @PathVariable UUID id) {
        PhotoRow photo = service.getPhoto(owner(actor), id.toString());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .body(photo.data());
    }

    private static long owner(Authentication actor) {
        try {
            return Long.parseLong(actor.getName());
        } catch (NullPointerException | NumberFormatException error) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
    }
}
