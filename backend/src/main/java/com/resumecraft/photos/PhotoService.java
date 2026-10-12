package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.PhotoRow;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates image originals and persists photos independently of resume linkage. */
@Service
public class PhotoService {
    public static final long MAX_FILE_BYTES = 2_000_000;
    private static final byte[] PNG_SIGNATURE = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
    private final PhotoMapper photos;

    public PhotoService(PhotoMapper photos) {
        this.photos = photos;
    }

    /** Only the authenticated numeric account identity supplies the owner; no multipart owner is trusted. */
    private Long owner(Authentication actor) {
        try {
            if (actor != null && actor.isAuthenticated()) {
                return Long.valueOf(actor.getName());
            }
        } catch (NumberFormatException ignored) {
            // A non-account principal cannot be used to address a user's resources.
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
    }

    /** Stores unchanged bytes after signature and decoder checks; never mutates a resume. */
    @Transactional
    public UUID uploadPhoto(Authentication actor, MultipartFile file) {
        Long userId = owner(actor);
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                    "사진은 2MB 이하만 등록할 수 있습니다.", "file");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException error) {
            throw unsupported();
        }
        String type = imageType(bytes);
        // MIME headers and filenames are untrusted; the detected format is the response media type.
        try (var input = new ByteArrayInputStream(bytes)) {
            if (ImageIO.read(input) == null) {
                throw unsupported();
            }
        } catch (IOException error) {
            throw unsupported();
        }
        UUID id = UUID.randomUUID();
        photos.insert(id, userId, type, bytes);
        return id;
    }

    /** Retrieves only owner-scoped originals, including unlinked photos; unlinking does not delete them. */
    @Transactional(readOnly = true)
    public PhotoRow getPhoto(Authentication actor, UUID id) {
        PhotoRow row = photos.findOwned(id, owner(actor));
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "404", "찾을 수 없습니다.", null);
        }
        return row;
    }

    private String imageType(byte[] bytes) {
        if (bytes.length >= PNG_SIGNATURE.length
                && Arrays.equals(Arrays.copyOf(bytes, PNG_SIGNATURE.length), PNG_SIGNATURE)) {
            return "image/png";
        }
        if (bytes.length >= 3 && bytes[0] == (byte) 0xff
                && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff) {
            return "image/jpeg";
        }
        throw unsupported();
    }

    private ApiException unsupported() {
        return new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE",
                "올바른 JPG 또는 PNG 사진을 선택해 주세요.", "file");
    }
}
