package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real security/controller/service tests with a stateful persistence boundary, not SQL execution. */
@WebMvcTest(PhotoController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, PhotoService.class})
class PhotoTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper mapper;
    private final Map<String, PhotoRow> rows = new HashMap<>();

    @BeforeEach
    void persistenceBoundaryRetainsActualWrites() {
        rows.clear();
        when(mapper.insert(any())).thenAnswer(call -> {
            PhotoRow row = call.getArgument(0);
            rows.put(row.id(), row);
            return 1;
        });
        when(mapper.findOwned(anyString(), anyLong())).thenAnswer(call -> {
            PhotoRow row = rows.get(call.getArgument(0));
            long owner = call.getArgument(1);
            return row != null && row.userId() == owner ? row : null;
        });
    }

    @Test
    void happyJpegUploadReturnsUuidAndOwnerGetReturnsOriginalBytes() throws Exception {
        byte[] bytes = image("jpeg");
        String id = upload(bytes, "image/jpeg");
        assertNotNull(UUID.fromString(id));
        mvc.perform(get("/api/photos/{id}", id).with(user("1")))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(content().bytes(bytes))
                .andExpect(header().string("Cache-Control", "no-store"));
        assertEquals(1, rows.size());
        verify(mapper, times(1)).insert(any());
    }

    @Test
    void sideEffectPngRetainsBytesMimeAndSessionOwnerOnly() throws Exception {
        byte[] bytes = image("png");
        String id = upload(bytes, "image/png");
        PhotoRow row = rows.get(id);
        assertEquals(1L, row.userId());
        assertEquals("image/png", row.contentType());
        assertArrayEquals(bytes, row.data());
        mvc.perform(get("/api/photos/{id}", id).with(user("1")))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(bytes));
    }

    @Test
    void anonymousUploadPrioritizes401AndDoesNotWrite() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/png")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.field").value(nullValue()));
        verifyNoInteractions(mapper);
        assertTrue(rows.isEmpty());
    }

    @Test
    void anonymousGetDoesNotExposeBytes() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void authenticatedUploadRequiresCsrf() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/png")).with(user("1")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignGetReturns404AndPreservesOwnerBytes() throws Exception {
        byte[] bytes = image("png");
        String id = upload(bytes, "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(user("2")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.field").value(nullValue()));
        assertArrayEquals(bytes, rows.get(id).data());
        assertEquals(1, rows.size());
    }

    @Test
    void missingGetReturnsSame404Envelope() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user("1")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("사진을 찾을 수 없습니다."))
                .andExpect(jsonPath("$.code").value("404"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void gifUploadIsUnsupportedAndPreservesExistingPhoto() throws Exception {
        String id = upload(image("png"), "image/png");
        PhotoRow previous = rows.get(id);
        clearInvocations(mapper);
        mvc.perform(multipart("/api/photos").file(file(image("gif"), "image/gif"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
                .andExpect(jsonPath("$.field").value("file"));
        assertSame(previous, rows.get(id));
        assertEquals(1, rows.size());
        verifyNoInteractions(mapper);
    }

    @Test
    void oversizeUploadReturns413WithoutReplacingStoredPhoto() throws Exception {
        String id = upload(image("jpeg"), "image/jpeg");
        byte[] original = rows.get(id).data().clone();
        clearInvocations(mapper);
        mvc.perform(multipart("/api/photos")
                        .file(file(Arrays.copyOf(original, 2_000_001), "image/jpeg"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"))
                .andExpect(jsonPath("$.field").value("file"));
        assertArrayEquals(original, rows.get(id).data());
        assertEquals(1, rows.size());
        verifyNoInteractions(mapper);
    }

    @Test
    void exactTwoMillionBytesAreAcceptedAndNeverReencoded() throws Exception {
        byte[] bytes = Arrays.copyOf(image("jpeg"), 2_000_000);
        String id = upload(bytes, "image/jpeg");
        assertArrayEquals(bytes, rows.get(id).data());
    }

    @Test
    void renamedGifCannotPassAsPng() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("gif"), "image/png"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
                .andExpect(jsonPath("$.field").value("file"));
        verifyNoInteractions(mapper);
    }

    @Test
    void pngSignatureWithoutDecodableImageIsRejected() throws Exception {
        byte[] bytes = Arrays.copyOf(image("png"), 12);
        mvc.perform(multipart("/api/photos").file(file(bytes, "image/png"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verifyNoInteractions(mapper);
    }

    @Test
    void mimeMismatchRejectsValidPngClaimingJpeg() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/jpeg"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verifyNoInteractions(mapper);
    }

    @Test
    void missingFileReturnsInputErrorNot500() throws Exception {
        mvc.perform(multipart("/api/photos").with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("400"))
                .andExpect(jsonPath("$.field").value("file"));
        verifyNoInteractions(mapper);
    }

    @Test
    void emptyFileReturnsInputErrorWithoutWrite() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(new byte[0], "image/png"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("file"));
        verifyNoInteractions(mapper);
    }

    @Test
    void persistenceErrorDoesNotLeakDatabaseDetail() throws Exception {
        doThrow(new IllegalStateException("secret SQL password")).when(mapper).insert(any());
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/png"))
                        .with(user("1")).with(csrf()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("500"))
                .andExpect(jsonPath("$.message").value("요청을 처리하지 못했습니다."));
        assertTrue(rows.isEmpty());
    }

    @Test
    void durableContractOperationsMatchExercisedHttpBehavior() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            Map<?, ?> contract = yaml.load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> post = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos")).get("post");
            Map<?, ?> get = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos/{id}")).get("get");
            assertEquals("uploadPhoto", post.get("operationId"));
            assertEquals("getPhoto", get.get("operationId"));
            assertTrue(((Map<?, ?>) post.get("responses")).containsKey("201"));
            assertTrue(((Map<?, ?>) get.get("responses")).containsKey("200"));
            String id = upload(image("png"), "image/png");
            mvc.perform(get("/api/photos/{id}", id).with(user("1"))).andExpect(status().isOk());
        }
    }

    private String upload(byte[] bytes, String mime) throws Exception {
        var result = mvc.perform(multipart("/api/photos").file(file(bytes, mime)).with(user("1")).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.data.photoId").isString())
                .andReturn();
        return json.readTree(result.getResponse().getContentAsString()).path("data").path("photoId").asText();
    }

    private static MockMultipartFile file(byte[] bytes, String mime) {
        return new MockMultipartFile("file", "portrait.png", mime, bytes);
    }

    private static byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output));
        return output.toByteArray();
    }
}
