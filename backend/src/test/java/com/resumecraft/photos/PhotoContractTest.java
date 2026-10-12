package com.resumecraft.photos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiErrorHandler;
import com.resumecraft.common.SecurityConfig;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.PhotoRow;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.yaml.snakeyaml.Yaml;

/** Real HTTP, security and service with a retained-write persistence double; does not prove SQL durability. */
@WebMvcTest(PhotoController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, PhotoService.class})
class PhotoContractTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;
    @MockBean
    private PhotoMapper photos;
    private final Map<UUID, PhotoRow> stored = new HashMap<>();

    @BeforeEach
    void persistenceBoundary() {
        stored.clear();
        when(photos.insert(any(), anyLong(), anyString(), any(byte[].class))).thenAnswer(call -> {
            UUID id = call.getArgument(0);
            stored.put(id, new PhotoRow(id, call.getArgument(1), call.getArgument(2),
                    call.getArgument(3), null));
            return 1;
        });
        when(photos.findOwned(any(), anyLong())).thenAnswer(call -> {
            PhotoRow row = stored.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1)) ? row : null;
        });
    }

    @Test
    void happyPngUploadReturnsUuidAndGetReturnsIdenticalOriginal() throws Exception {
        roundTrip("png", "image/png");
    }

    @Test
    void happyJpegUploadReturnsUuidAndGetReturnsIdenticalOriginal() throws Exception {
        roundTrip("jpg", "image/jpeg");
    }

    private void roundTrip(String format, String type) throws Exception {
        byte[] bytes = image(format);
        var result = mvc.perform(multipart("/api/photos").file(file(bytes, "application/octet-stream"))
                        .with(user("7")).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isEmpty())
                .andExpect(jsonPath("$.data.photoId").isString())
                .andReturn();
        UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsString())
                .path("data").path("photoId").asText());
        assertThat(stored.get(id).userId()).isEqualTo(7L);
        assertThat(stored.get(id).contentType()).isEqualTo(type);
        assertThat(stored.get(id).data()).containsExactly(bytes);
        mvc.perform(get("/api/photos/{id}", id).with(user("7")))
                .andExpect(status().isOk()).andExpect(content().contentType(type))
                .andExpect(content().bytes(bytes)).andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void authAnonymousUploadDoesNotInsert() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/png")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(photos);
    }

    @Test
    void authAnonymousDownloadDoesNotRead() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(photos);
    }

    @Test
    void authForeignOwnerDownloadIsIndistinguishableFromMissing() throws Exception {
        UUID id = existing();
        mvc.perform(get("/api/photos/{id}", id).with(user("8")))
                .andExpect(status().isNotFound()).andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.field").isEmpty());
        assertThat(stored).hasSize(1);
        mvc.perform(get("/api/photos/{id}", id).with(user("7")))
                .andExpect(status().isOk()).andExpect(content().bytes(stored.get(id).data()));
    }

    @Test
    void missingDownloadReturnsSafeEnvelope() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user("7")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void validationUnsupportedContentPreservesExistingPhoto() throws Exception {
        UUID id = existing();
        byte[] old = stored.get(id).data().clone();
        mvc.perform(multipart("/api/photos").file(file("not a photo".getBytes(), "image/png"))
                        .with(user("7")).with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
                .andExpect(jsonPath("$.field").value("file"));
        assertThat(stored).hasSize(1);
        assertThat(stored.get(id).data()).containsExactly(old);
        verify(photos, never()).insert(any(), anyLong(), anyString(), any());
    }

    @Test
    void validationSignatureOnlyCannotPassDecoder() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(new byte[]{-1, -40, -1}, "image/jpeg"))
                        .with(user("7")).with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verifyNoInteractions(photos);
    }

    @Test
    void validationGifRenamedPngIsRejected() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("gif"), "image/png"))
                        .with(user("7")).with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verifyNoInteractions(photos);
    }

    @Test
    void businessAboveDecimalLimitPreservesOriginalAndDoesNotInsert() throws Exception {
        UUID id = existing();
        byte[] old = stored.get(id).data().clone();
        byte[] bytes = java.util.Arrays.copyOf(image("png"), 2_000_001);
        mvc.perform(multipart("/api/photos").file(file(bytes, "image/png")).with(user("7")).with(csrf()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
        assertThat(stored).hasSize(1);
        assertThat(stored.get(id).data()).containsExactly(old);
        verify(photos, never()).insert(any(), anyLong(), anyString(), any());
    }

    @Test
    void businessExactDecimalLimitIsAllowedAndUnchanged() throws Exception {
        byte[] bytes = java.util.Arrays.copyOf(image("png"), 2_000_000);
        mvc.perform(multipart("/api/photos").file(file(bytes, "image/png")).with(user("7")).with(csrf()))
                .andExpect(status().isOk());
        assertThat(stored.values().iterator().next().data()).containsExactly(bytes);
    }

    @Test
    void validationMissingPartIs400() throws Exception {
        mvc.perform(post("/api/photos").contentType(MediaType.MULTIPART_FORM_DATA)
                        .with(user("7")).with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("400"));
        verifyNoInteractions(photos);
    }

    @Test
    void authMissingCsrfPreventsInsert() throws Exception {
        mvc.perform(multipart("/api/photos").file(file(image("png"), "image/png")).with(user("7")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(photos);
    }

    @Test
    @SuppressWarnings("unchecked")
    void classpathContractAndRealHttpUseDeclaredPhotoOperations() throws Exception {
        Map<String, Object> contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new Yaml().load(input);
        }
        var paths = (Map<String, Map<String, Map<String, Object>>>) contract.get("paths");
        assertThat(paths.get("/api/photos").get("post").get("operationId")).isEqualTo("uploadPhoto");
        assertThat(paths.get("/api/photos/{id}").get("get").get("operationId")).isEqualTo("getPhoto");
        roundTrip("png", "image/png");
    }

    private UUID existing() throws Exception {
        UUID id = UUID.randomUUID();
        stored.put(id, new PhotoRow(id, 7L, "image/png", image("png"), OffsetDateTime.now()));
        return id;
    }

    static byte[] image(String format) throws Exception {
        var image = new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB);
        try (var output = new ByteArrayOutputStream()) {
            assertThat(ImageIO.write(image, format, output)).isTrue();
            return output.toByteArray();
        }
    }

    private MockMultipartFile file(byte[] bytes, String type) {
        return new MockMultipartFile("file", "photo.png", type, bytes);
    }
}
