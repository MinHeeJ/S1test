package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionUser;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Session-owned photo upload and private binary delivery; resume linking is a separate operation. */
@RestController
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Creates one photo owned by the session, accepting exactly one multipart file. */
    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse.Data<PhotoUploadResult>> uploadPhoto(
            @AuthenticationPrincipal SessionUser user,
            @RequestPart(value = "file", required = false) MultipartFile[] files) {
        UUID owner = owner(user);
        if (files == null || files.length != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Bad Request", "Bad Request", "file");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.data(service.upload(owner, files[0])));
    }

    /** Returns the original stored media type and bytes without allowing public or cross-user caches. */
    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> getPhoto(
            @AuthenticationPrincipal SessionUser user,
            @PathVariable UUID id) {
        var photo = service.get(owner(user), id);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .header("Cache-Control", "private, no-store")
            .header("X-Content-Type-Options", "nosniff")
            .body(photo.data());
    }

    private UUID owner(SessionUser user) {
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Unauthorized", null);
        }
        return user.id();
    }
}
