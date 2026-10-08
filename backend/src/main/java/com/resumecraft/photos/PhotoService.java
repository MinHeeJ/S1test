package com.resumecraft.photos;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.PhotoRow;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Stores original validated image bytes separately from the resume's later photo reference update. */
@Service
public class PhotoService {
    public static final int MAX_PHOTO_BYTES = 2_000_000;
    private final PhotoMapper photos;

    public PhotoService(PhotoMapper photos) {
        this.photos = photos;
    }

    /** The authenticated owner is authoritative; MIME declarations and filenames are not evidence of image type. */
    @Transactional
    public PhotoUploadResult upload(UUID userId, MultipartFile file) {
        if (file.getSize() > MAX_PHOTO_BYTES) {
            throw tooLarge();
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw unsupported();
        }
        if (bytes.length > MAX_PHOTO_BYTES) {
            throw tooLarge();
        }
        String contentType = imageType(bytes);
        UUID id = UUID.randomUUID();
        photos.insert(new PhotoRow(id, userId, contentType, bytes, OffsetDateTime.now()));
        return new PhotoUploadResult(id);
    }

    /** Missing and foreign photos are indistinguishable; unlinking a resume does not delete these bytes. */
    @Transactional(readOnly = true)
    public PhotoRow get(UUID userId, UUID id) {
        PhotoRow row = photos.findOwned(id, userId);
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Not Found", "Not Found", null);
        }
        return row;
    }

    private String imageType(byte[] bytes) {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) {
                throw unsupported();
            }
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw unsupported();
            }
            var reader = readers.next();
            try {
                String format = reader.getFormatName();
                String type = switch (format.toLowerCase(java.util.Locale.ROOT)) {
                    case "jpeg", "jpg" -> "image/jpeg";
                    case "png" -> "image/png";
                    default -> throw unsupported();
                };
                reader.setInput(input, true, true);
                // Decode actual content, not only magic bytes. A renamed or truncated file cannot become a photo.
                if (reader.read(0) == null) {
                    throw unsupported();
                }
                return type;
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw unsupported();
        }
    }

    private ApiException unsupported() {
        return new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE", "JPG·PNG 사진만 사용할 수 있습니다.", "file");
    }

    private ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "사진 크기는 2MB 이하여야 합니다.", "file");
    }
}
