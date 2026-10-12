package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates originals before insertion; uploading never mutates a resume or deletes an older photo. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** Owns only the image insert transaction, not the later resume connection PUT. */
    @Transactional
    public UploadedPhoto uploadPhoto(String identity, MultipartFile file) {
        UUID owner = owner(identity);
        if (file == null || file.isEmpty()) {
            throw invalidFile();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                "사진은 2MB 이하만 업로드할 수 있습니다.", "file");
        }
        String contentType = file.getContentType();
        if (!"image/jpeg".equals(contentType) && !"image/png".equals(contentType)) {
            throw invalidFile();
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
            validateDecodedFormat(bytes, contentType);
        } catch (IOException error) {
            throw invalidFile();
        }
        UUID id = UUID.randomUUID();
        mapper.insert(new Photo(id, owner, contentType, bytes, OffsetDateTime.now(ZoneOffset.UTC)));
        return new UploadedPhoto(id);
    }

    /** Owner-scoped lookup also permits retained, currently unlinked photos under the preservation policy. */
    @Transactional(readOnly = true)
    public Photo getPhoto(String identity, String id) {
        UUID owner = owner(identity);
        UUID photoId;
        try {
            photoId = UUID.fromString(id);
        } catch (IllegalArgumentException error) {
            throw notFound();
        }
        Photo photo = mapper.findOwned(photoId, owner);
        if (photo == null) {
            throw notFound();
        }
        return photo;
    }

    private UUID owner(String identity) {
        UUID id = identity == null ? null : mapper.selectUserId(identity);
        if (id == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다.", null);
        }
        return id;
    }

    // MIME must match the decoder, not just an extension or a client-declared header.
    private void validateDecodedFormat(byte[] bytes, String contentType) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalidFile();
            }
            var reader = readers.next();
            try {
                String expected = "image/jpeg".equals(contentType) ? "JPEG" : "PNG";
                if (!expected.equalsIgnoreCase(reader.getFormatName())) {
                    throw invalidFile();
                }
                reader.setInput(input, true, true);
                if (reader.read(0) == null) {
                    throw invalidFile();
                }
            } finally {
                reader.dispose();
            }
        }
    }

    private ApiException invalidFile() {
        return new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE",
            "JPG 또는 PNG 사진을 선택해주세요.", "file");
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사진을 찾을 수 없습니다.", null);
    }
}
