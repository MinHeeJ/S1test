package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates actual image bytes and persists originals independently of resume reference updates. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** Rejects before INSERT; a successful upload never edits or deletes an existing resume/photo. */
    @Transactional
    public UUID upload(UUID userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw unsupported();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                "FILE_TOO_LARGE", "사진은 2MB 이하만 등록할 수 있습니다.", null);
        }
        byte[] bytes = file.getBytes();
        String type = file.getContentType();
        if (!"image/png".equals(type) && !"image/jpeg".equals(type)) {
            throw unsupported();
        }
        // Decoding, rather than extension or magic bytes alone, rejects renamed and malformed files.
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw unsupported();
            }
            var reader = readers.next();
            try {
                String format = reader.getFormatName();
                boolean matches = "image/png".equals(type) && "png".equalsIgnoreCase(format)
                    || "image/jpeg".equals(type) && "jpeg".equalsIgnoreCase(format);
                if (!matches) {
                    throw unsupported();
                }
                reader.setInput(input);
                if (reader.read(0) == null) {
                    throw unsupported();
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException error) {
            throw unsupported();
        }
        UUID id = UUID.randomUUID();
        mapper.insert(new Photo(id, userId, type, bytes));
        return id;
    }

    /** Photo ownership alone governs access, including unlinked photos and deleted-resume references. */
    @Transactional(readOnly = true)
    public Photo get(UUID userId, UUID id) {
        Photo photo = mapper.findOwned(id, userId);
        if (photo == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사진을 찾을 수 없습니다.", null);
        }
        return photo;
    }

    private static ApiException unsupported() {
        return new ApiException(HttpStatus.BAD_REQUEST,
            "UNSUPPORTED_FILE_TYPE", "올바른 JPG 또는 PNG 사진을 선택해 주세요.", null);
    }
}
