package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiErrorHandler;
import com.resumecraft.common.SecurityConfig;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.PhotoRow;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.MULTIPART_FORM_DATA;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PhotoController.class)
@org.springframework.test.context.ContextConfiguration(classes = com.resumecraft.common.ResumeCraftApplication.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, PhotoService.class})
class PhotoContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper photos;
    private final UUID owner = UUID.randomUUID();
    private final Map<UUID, PhotoRow> stored = new HashMap<>();

    @BeforeEach
    void persistenceBoundaryRetainsActualWrites() {
        stored.clear();
        when(photos.insert(any())).thenAnswer(call -> {
            PhotoRow row = call.getArgument(0);
            stored.put(row.id(), row);
            return 1;
        });
        when(photos.findOwned(any(), any())).thenAnswer(call -> {
            PhotoRow row = stored.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1)) ? row : null;
        });
    }

    private RequestPostProcessor actor(UUID id) {
        var principal = new SessionUser(id, "photo-test@example.com", "사진 시험");
        return authentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, java.util.List.of()));
    }

    private byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    private UUID upload(byte[] bytes, String declaredType) throws Exception {
        var result = mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "portrait.png", declaredType, bytes))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.photoId").isString())
            .andExpect(jsonPath("$.data.userId").doesNotExist())
            .andReturn();
        return UUID.fromString(json.readTree(result.getResponse().getContentAsByteArray())
            .path("data").path("photoId").asText());
    }

    private RequestPostProcessor uploadParts(MockMultipartFile... files) {
        return request -> {
            var upload = new MockMultipartHttpServletRequest(request.getServletContext());
            upload.setMethod(request.getMethod());
            upload.setRequestURI(request.getRequestURI());
            upload.setContextPath(request.getContextPath());
            upload.setServletPath(request.getServletPath());
            upload.setContentType(request.getContentType());
            for (MockMultipartFile file : files) {
                upload.addFile(file);
            }
            return upload;
        };
    }

    @Test
    @DisplayName("POST /api/photos auth: 익명 업로드는 CSRF가 있어도 401이며 저장하지 않는다")
    void explicitPostAnonymousUploadDoesNotWrite() throws Exception {
        mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts(new MockMultipartFile("file", image("png")))).with(csrf()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("Unauthorized"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap());
        verifyNoInteractions(photos);
        assertThat(stored).isEmpty();
    }

    @Test
    @DisplayName("POST /api/photos happy: 유효한 PNG 업로드는 201과 저장된 사진 UUID를 반환한다")
    void explicitPostReturnsCreatedPhotoId() throws Exception {
        byte[] bytes = image("png");
        var result = mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts(new MockMultipartFile("file", "portrait.png", "image/png", bytes)))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.photoId").isString())
            .andExpect(jsonPath("$.data.userId").doesNotExist())
            .andReturn();
        UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsByteArray())
            .path("data").path("photoId").asText());
        assertThat(stored).hasSize(1).containsKey(id);
        PhotoRow row = stored.get(id);
        assertThat(row.id()).isEqualTo(id);
        assertThat(row.userId()).isEqualTo(owner);
        assertThat(row.contentType()).isEqualTo("image/png");
        assertThat(row.data()).isEqualTo(bytes);
        verify(photos).insert(row);
        mvc.perform(get("/api/photos/{id}", id).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
    }

    @Test
    @DisplayName("POST /api/photos side-effect: DB content_type 및 data bytea 매핑 입력과 getPhoto content 보존"
        + " (mapper 대역 검증, SQL 실행 아님)")
    void explicitPostRetainsByteaMappingInputAndGetPhotoContent() throws Exception {
        byte[] bytes = image("jpeg");
        var result = mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts(new MockMultipartFile("file", "renamed.png", "image/png", bytes)))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.photoId").isString())
            .andReturn();
        UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsByteArray())
            .path("data").path("photoId").asText());
        assertThat(stored).hasSize(1).containsKey(id);
        PhotoRow row = stored.get(id);
        assertThat(row.id()).isEqualTo(id);
        assertThat(row.userId()).isEqualTo(owner);
        assertThat(row.contentType()).isEqualTo("image/jpeg");
        assertThat(row.data()).isEqualTo(bytes);
        assertThat(row.createdAt()).isNotNull();
        verify(photos).insert(row);
        mvc.perform(get("/api/photos/{id}", id).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/jpeg"))
            .andExpect(content().bytes(bytes))
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        verify(photos).findOwned(id, owner);
        verifyNoMoreInteractions(photos);
    }

    @Test
    @DisplayName("POST /api/photos business: 2MB 초과는 413이며 기존 사진과 바이트를 변경하지 않는다")
    void explicitPostOverLimitDoesNotChangeStoredPhoto() throws Exception {
        byte[] bytes = image("png");
        UUID previous = upload(bytes, "image/png");
        PhotoRow before = stored.get(previous);
        clearInvocations(photos);
        mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts(new MockMultipartFile("file", "large.png", "image/png", new byte[2_000_001])))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"))
            .andExpect(jsonPath("$.field").value("file"))
            .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(photos);
        assertThat(stored).hasSize(1).containsEntry(previous, before);
        assertThat(stored.get(previous).data()).isEqualTo(bytes);
        mvc.perform(get("/api/photos/{id}", previous).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
        verify(photos, never()).insert(any());
    }

    @Test
    @DisplayName("POST /api/photos validation: PNG로 위장한 GIF는 400이며 기존 사진을 보존한다")
    void explicitPostUnsupportedContentDoesNotChangeStoredPhoto() throws Exception {
        byte[] bytes = image("png");
        UUID previous = upload(bytes, "image/png");
        PhotoRow before = stored.get(previous);
        clearInvocations(photos);
        mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts(new MockMultipartFile("file", "renamed.png", "image/png", image("gif"))))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
            .andExpect(jsonPath("$.field").value("file"))
            .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(photos);
        assertThat(stored).hasSize(1).containsEntry(previous, before);
        assertThat(stored.get(previous).data()).isEqualTo(bytes);
        mvc.perform(get("/api/photos/{id}", previous).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
        verify(photos, never()).insert(any());
    }

    @Test
    @DisplayName("POST /api/photos validation: 필수 file 누락은 400이며 저장하지 않는다")
    void explicitPostMissingFileDoesNotWrite() throws Exception {
        mvc.perform(post("/api/photos").contentType(MULTIPART_FORM_DATA)
                .with(uploadParts()).with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("Bad Request"))
            .andExpect(jsonPath("$.field").value("file"))
            .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(photos);
        assertThat(stored).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpeg"})
    void uploadAndOwnedGetKeepOriginalBytesAndDecodedType(String format) throws Exception {
        byte[] bytes = image(format);
        UUID id = upload(bytes, "application/octet-stream");
        assertThat(stored).hasSize(1);
        assertThat(stored.get(id).userId()).isEqualTo(owner);
        assertThat(stored.get(id).data()).isEqualTo(bytes);
        assertThat(stored.get(id).createdAt()).isNotNull();
        mvc.perform(get("/api/photos/{id}", id).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/" + format))
            .andExpect(header().string("Cache-Control", "private, no-store"))
            .andExpect(content().bytes(bytes));
    }

    @Test
    void anonymousUploadWithCsrfIs401AndDoesNotWrite() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", image("png"))).with(csrf()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("Unauthorized"))
            .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(photos);
    }

    @Test
    void anonymousGetIs401AndDoesNotReadBytes() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.meta").isMap());
        verifyNoInteractions(photos);
    }

    @Test
    void foreignGetIs404AndDoesNotExposeImage() throws Exception {
        UUID id = upload(image("png"), "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(actor(UUID.randomUUID())))
            .andExpect(status().isNotFound())
            .andExpect(content().contentTypeCompatibleWith("application/json"))
            .andExpect(jsonPath("$.code").value("Not Found"))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(stored).hasSize(1);
    }

    @Test
    void missingGetIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(actor(owner)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void uploadWithoutCsrfIsForbiddenAndDoesNotWrite() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", image("png"))).with(actor(owner)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("Forbidden"));
        verifyNoInteractions(photos);
    }

    @ParameterizedTest
    @ValueSource(strings = {"text", "gif", "truncated", "empty"})
    void fakeMimeRenamedUnsupportedOrBrokenContentDoesNotWrite(String kind) throws Exception {
        byte[] bytes = switch (kind) {
            case "gif" -> image("gif");
            case "truncated" -> Arrays.copyOf(image("png"), 20);
            case "empty" -> new byte[0];
            default -> "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        };
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "renamed.png", "image/png", bytes))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
            .andExpect(jsonPath("$.field").value("file"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap());
        verify(photos, never()).insert(any());
    }

    @Test
    void exactDecimalLimitIsAccepted() throws Exception {
        upload(Arrays.copyOf(image("png"), 2_000_000), "image/png");
        assertThat(stored).hasSize(1);
    }

    @Test
    void oneByteOverDecimalLimitDoesNotWriteOrChangeExistingPhoto() throws Exception {
        UUID previous = upload(image("png"), "image/png");
        PhotoRow before = stored.get(previous);
        clearInvocations(photos);
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "large.png", "image/png", new byte[2_000_001]))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
        verify(photos, never()).insert(any());
        assertThat(stored).hasSize(1).containsEntry(previous, before);
    }

    @Test
    void missingFileIs400AndDoesNotWrite() throws Exception {
        mvc.perform(multipart("/api/photos").with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("Bad Request"));
        verifyNoInteractions(photos);
    }

    @Test
    void multipleFilesAreRejectedWithoutPartialWrite() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", image("png")))
                .file(new MockMultipartFile("file", image("jpeg")))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(photos);
    }

    @Test
    void internalFailureDoesNotLeakStorageInformation() throws Exception {
        when(photos.findOwned(any(), any())).thenThrow(new RuntimeException("password database details"));
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(actor(owner)))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("Internal Server Error"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void approvedContractLoadsFromClasspath() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            assertThat(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8))
                .contains("operationId: uploadPhoto", "operationId: getPhoto");
        }
    }
}
