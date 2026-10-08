package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionUser;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** Session-owned multipart upload and private original-image HTTP boundary. */
@RestController
@RequestMapping("/api/photos")
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Issues a new photo UUID; linking it is a separate whole-resume PUT. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<PhotoUploadResult>> uploadPhoto(
        @AuthenticationPrincipal SessionUser user,
        @RequestPart(value = "file", required = false) MultipartFile file
    ) throws IOException {
        UUID id = service.upload(owner(user), file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(new PhotoUploadResult(id)));
    }

    /** Never allows caches to serve one authenticated user's image to another session. */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPhoto(
        @AuthenticationPrincipal SessionUser user,
        @PathVariable UUID id
    ) {
        Photo photo = service.get(owner(user), id);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .body(photo.data());
    }

    private static UUID owner(SessionUser user) {
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다.", null);
        }
        return user.id();
    }

    /** The only public upload result defined by the approved wire contract. */
    public record PhotoUploadResult(UUID photoId) {
    }
}
