package com.resumecraft.photos;

import com.resumecraft.common.CurrentUserId;
import com.resumecraft.common.DomainException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates real image formats and commits bytes without changing any resume connection. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** Validation completes before insert; failed uploads never replace or purge existing photos. */
    @Transactional
    public UploadedPhoto upload(MultipartFile file) {
        UUID owner = CurrentUserId.require();
        if (file == null || file.isEmpty()) {
            throw unsupported();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE,
                "FILE_TOO_LARGE", "사진은 2MB 이하만 등록할 수 있습니다.", "file");
        }
        String mime = file.getContentType();
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime)) {
            throw unsupported();
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
            validateImage(bytes, mime);
        } catch (IOException exception) {
            throw unsupported();
        }
        UUID id = UUID.randomUUID();
        if (mapper.insert(new PhotoRecord(id, owner, mime, bytes)) != 1) {
            throw new IllegalStateException("Photo insert did not complete");
        }
        return new UploadedPhoto(id);
    }

    /** Unconnected or formerly connected photos remain available to their owner, never to others. */
    @Transactional(readOnly = true)
    public PhotoRecord get(UUID id) {
        PhotoRecord photo = mapper.findOwned(id, CurrentUserId.require());
        if (photo == null) {
            throw DomainException.notFound();
        }
        return photo;
    }

    private static void validateImage(byte[] bytes, String mime) throws IOException {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw unsupported();
            }
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName();
                boolean matches = "image/png".equals(mime)
                    ? "PNG".equalsIgnoreCase(format) : "JPEG".equalsIgnoreCase(format);
                if (!matches) {
                    throw unsupported();
                }
                reader.setInput(input);
                // Decode in constant output space to avoid expanding a small compressed image unboundedly.
                var parameters = reader.getDefaultReadParam();
                parameters.setSourceSubsampling(Math.max(1, reader.getWidth(0)),
                    Math.max(1, reader.getHeight(0)), 0, 0);
                if (reader.read(0, parameters) == null) {
                    throw unsupported();
                }
            } finally {
                reader.dispose();
            }
        }
    }

    private static DomainException unsupported() {
        return new DomainException(HttpStatus.BAD_REQUEST,
            "UNSUPPORTED_FILE_TYPE", "JPG 또는 PNG 사진을 선택해 주세요.", "file");
    }
}
