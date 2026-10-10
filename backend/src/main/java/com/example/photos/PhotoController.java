package com.example.photos;

import com.example.common.ApiException;
import com.example.common.ApiResponse;
import java.util.Map;
import java.util.UUID;
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

/** Transports session-owned uploads and private original-image responses through the shared security chain. */
@RestController
@RequestMapping("/api/photos")
public class PhotoController {
    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    /** Upload only issues a photoId; linking to a resume belongs to the later full resume PUT. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Map<String, UUID>> uploadPhoto(
        Authentication authentication,
        @RequestPart("file") MultipartFile file
    ) {
        return ApiResponse.ok(Map.of("photoId", service.uploadPhoto(owner(authentication), file)));
    }

    /** Returns bytes only after the owner-scoped query; no public or shared-cache image response is emitted. */
    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getPhoto(Authentication authentication, @PathVariable UUID id) {
        Photo photo = service.getPhoto(owner(authentication), id);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentType(MediaType.parseMediaType(photo.getContentType()))
            .body(photo.getData());
    }

    private UUID owner(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UUID userId)) {
            throw new ApiException(401, "401", "로그인이 필요합니다.", null);
        }
        return userId;
    }
}
