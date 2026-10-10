package com.example.photos;

import com.example.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates original images before the independent photo transaction, without mutating resume references. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** MIME and decoded format must agree; success preserves the original bytes, not a re-encoded image. */
    @Transactional
    public UUID uploadPhoto(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw unsupported();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(413, "FILE_TOO_LARGE", "사진은 2MB 이하만 가능합니다.", "file");
        }
        String mime = file.getContentType();
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime)) {
            throw unsupported();
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
            validateImage(bytes, mime);
        } catch (IOException | IllegalArgumentException exception) {
            throw unsupported();
        }
        var photo = new Photo();
        photo.setId(UUID.randomUUID());
        photo.setUserId(userId);
        photo.setContentType(mime);
        photo.setData(bytes);
        if (mapper.insert(photo) != 1) {
            throw new ApiException(500, "500", "사진을 저장할 수 없습니다.", null);
        }
        return photo.getId();
    }

    /** Missing and foreign photos have the same 404; resume deletion does not affect photo ownership. */
    @Transactional(readOnly = true)
    public Photo getPhoto(UUID userId, UUID id) {
        Photo photo = mapper.findOwned(id, userId);
        if (photo == null) {
            throw new ApiException(404, "404", "사진을 찾을 수 없습니다.", null);
        }
        return photo;
    }

    private void validateImage(byte[] bytes, String mime) throws IOException {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw unsupported();
            }
            var reader = readers.next();
            try {
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!(mime.equals("image/png") && format.equals("png"))
                    && !(mime.equals("image/jpeg") && (format.equals("jpeg") || format.equals("jpg")))) {
                    throw unsupported();
                }
                reader.setInput(input);
                if (reader.read(0) == null) {
                    throw unsupported();
                }
            } finally {
                reader.dispose();
            }
        }
    }

    private ApiException unsupported() {
        return new ApiException(400, "UNSUPPORTED_FILE_TYPE", "JPG 또는 PNG 사진을 선택해 주세요.", "file");
    }
}
