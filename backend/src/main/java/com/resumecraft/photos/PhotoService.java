package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.PhotoRow;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates decoded image media and persists original bytes independently of resume linkage. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** Only validated JPG/PNG originals are inserted; the session supplies the owner. */
    @Transactional
    public UUID upload(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "사진을 선택해주세요.", "file");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "FILE_TOO_LARGE", "사진은 2MB 이하만 가능합니다.", "file");
        }
        String contentType = file.getContentType();
        if (!"image/jpeg".equals(contentType) && !"image/png".equals(contentType)) {
            throw unsupported();
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) {
                    throw unsupported();
                }
                var reader = readers.next();
                try {
                    reader.setInput(input);
                    String format = reader.getFormatName();
                    boolean matches = "image/png".equals(contentType)
                            ? "png".equalsIgnoreCase(format)
                            : "jpeg".equalsIgnoreCase(format) || "jpg".equalsIgnoreCase(format);
                    if (!matches || reader.read(0) == null) {
                        throw unsupported();
                    }
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw unsupported();
        }
        UUID id = UUID.randomUUID();
        mapper.insert(new PhotoRow(id, userId, contentType, bytes, Instant.now()));
        return id;
    }

    /** Ownership is enforced in the query; absent and foreign ids share the same 404. */
    @Transactional(readOnly = true)
    public PhotoRow get(UUID userId, UUID id) {
        PhotoRow row = mapper.findOwned(id, userId);
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사진을 찾을 수 없습니다.", null);
        }
        return row;
    }

    private static ApiException unsupported() {
        return new ApiException(HttpStatus.BAD_REQUEST,
                "UNSUPPORTED_FILE_TYPE", "JPG 또는 PNG 사진만 가능합니다.", "file");
    }
}
