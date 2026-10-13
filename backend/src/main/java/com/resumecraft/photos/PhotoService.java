package com.resumecraft.photos;

import com.resumecraft.common.DomainException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Validates images and preserves their original bytes independently of resume links. */
@Service
public class PhotoService {
    public static final int MAX_BYTES = 2_000_000;
    private final PhotoMapper mapper;

    public PhotoService(PhotoMapper mapper) {
        this.mapper = mapper;
    }

    /** Upload commits only a photo; replacement, unlinking and failed PUTs never delete it. */
    @Transactional
    public UploadedPhoto uploadPhoto(long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "400", "사진 파일을 선택해 주세요.", "file");
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
            if (!signatureMatches(bytes, mime)) {
                throw unsupported();
            }
            // Decode without re-encoding: a renamed file or corrupt image cannot become stored content.
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) {
                    throw unsupported();
                }
                var reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    String format = reader.getFormatName();
                    boolean match = "image/png".equals(mime) ? "PNG".equalsIgnoreCase(format)
                            : "JPEG".equalsIgnoreCase(format);
                    if (!match || reader.read(0) == null) {
                        throw unsupported();
                    }
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | IllegalArgumentException error) {
            throw unsupported();
        }
        String id = UUID.randomUUID().toString();
        if (mapper.insert(new PhotoRow(id, userId, mime, bytes)) != 1) {
            throw new IllegalStateException("Photo insert did not persist one row");
        }
        return new UploadedPhoto(id);
    }

    /** Foreign and missing identifiers deliberately share the same non-disclosing rejection. */
    @Transactional(readOnly = true)
    public PhotoRow getPhoto(long userId, String id) {
        PhotoRow row = mapper.findOwned(id, userId);
        if (row == null) {
            throw new DomainException(HttpStatus.NOT_FOUND, "404", "사진을 찾을 수 없습니다.", null);
        }
        return row;
    }

    private static boolean signatureMatches(byte[] bytes, String mime) {
        if ("image/jpeg".equals(mime)) {
            return bytes.length >= 3 && bytes[0] == (byte) 0xff
                    && bytes[1] == (byte) 0xd8 && bytes[2] == (byte) 0xff;
        }
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        return bytes.length >= png.length && Arrays.equals(Arrays.copyOf(bytes, png.length), png);
    }

    private static DomainException unsupported() {
        return new DomainException(HttpStatus.BAD_REQUEST,
                "UNSUPPORTED_FILE_TYPE", "JPG 또는 PNG 사진만 등록할 수 있습니다.", "file");
    }
}
