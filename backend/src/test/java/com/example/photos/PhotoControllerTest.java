package com.example.photos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.common.ApiErrorHandler;
import com.example.common.SecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.yaml.snakeyaml.Yaml;

@WebMvcTest(
    controllers = PhotoController.class,
    excludeAutoConfiguration =
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@org.springframework.test.context.ContextConfiguration(classes = PhotoController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, PhotoService.class})
class PhotoControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper mapper;
    private final UUID owner = UUID.randomUUID();
    private final Map<UUID, Photo> rows = new HashMap<>();

    @BeforeEach
    void persistenceBoundaryRetainsActualWrites() {
        rows.clear();
        when(mapper.insert(any(Photo.class))).thenAnswer(call -> {
            Photo row = call.getArgument(0);
            rows.put(row.getId(), row);
            return 1;
        });
        when(mapper.findOwned(any(UUID.class), any(UUID.class))).thenAnswer(call -> {
            Photo row = rows.get(call.getArgument(0));
            return row != null && row.getUserId().equals(call.getArgument(1)) ? row : null;
        });
    }

    private RequestPostProcessor actor(UUID id) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(id, null, List.of()));
    }

    static byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    private UUID upload(byte[] bytes, String mime) throws Exception {
        var response = mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "portrait", mime, bytes))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isEmpty())
            .andExpect(jsonPath("$.data.photoId").isString())
            .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(response).path("data").path("photoId").asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpeg"})
    void uploadedOriginalBytesAndSessionOwnerAreRetainedAndReturned(String format) throws Exception {
        byte[] bytes = image(format);
        String mime = "image/" + format;
        UUID id = upload(bytes, mime);
        assertThat(rows.get(id).getUserId()).isEqualTo(owner);
        assertThat(rows.get(id).getContentType()).isEqualTo(mime);
        assertThat(rows.get(id).getData()).isEqualTo(bytes);
        mvc.perform(get("/api/photos/{id}", id).with(actor(owner)))
            .andExpect(status().isOk())
            .andExpect(content().contentType(mime))
            .andExpect(content().bytes(bytes))
            .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void exactDecimalLimitIsAccepted() throws Exception {
        upload(Arrays.copyOf(image("png"), 2_000_000), "image/png");
        assertThat(rows).hasSize(1);
    }

    @Test
    void oversizedPhotoIs413AndDoesNotWrite() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "large.png", "image/png", new byte[2_000_001]))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"))
            .andExpect(jsonPath("$.success").value(false));
        verify(mapper, never()).insert(any());
    }

    @Test
    void unsupportedMimeDoesNotWrite() throws Exception {
        reject("image/gif", image("png"));
    }

    @Test
    void mimeMustMatchActualDecodedFormat() throws Exception {
        reject("image/png", image("jpeg"));
    }

    @Test
    void renamedNonImageIsRejected() throws Exception {
        reject("image/png", "not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void truncatedImageIsRejected() throws Exception {
        reject("image/png", Arrays.copyOf(image("png"), 24));
    }

    private void reject(String mime, byte[] bytes) throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "portrait.png", mime, bytes))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.field").value("file"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void missingFileIs400() throws Exception {
        mvc.perform(multipart("/api/photos").with(actor(owner)).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousUploadCannotAddPhoto() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "photo.png", "image/png", image("png"))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousGetCannotExposeBytes() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void authenticatedUploadRequiresCsrf() throws Exception {
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "photo.png", "image/png", image("png")))
                .with(actor(owner)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignPhotoIs404WithoutImageBytes() throws Exception {
        UUID id = upload(image("png"), "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(actor(UUID.randomUUID())))
            .andExpect(status().isNotFound()).andExpect(content().contentTypeCompatibleWith("application/json"))
            .andExpect(jsonPath("$.code").value("404"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        assertThat(rows).hasSize(1);
    }

    @Test
    void absentPhotoIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(actor(owner)))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
    }

    @Test
    void persistenceFailureDoesNotLeakSql() throws Exception {
        when(mapper.insert(any())).thenThrow(new IllegalStateException("secret SQL password"));
        mvc.perform(multipart("/api/photos")
                .file(new MockMultipartFile("file", "photo.png", "image/png", image("png")))
                .with(actor(owner)).with(csrf()))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("500"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
    }

    @Test
    void durableContractOperationsMatchHttpBehavior() throws Exception {
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<String, Object> document = new Yaml().load(stream);
            var paths = (Map<?, ?>) document.get("paths");
            var postOperation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos")).get("post");
            var getOperation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos/{id}")).get("get");
            assertThat(postOperation.get("operationId")).isEqualTo("uploadPhoto");
            assertThat(getOperation.get("operationId")).isEqualTo("getPhoto");
        }
        UUID id = upload(image("png"), "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(actor(owner)))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"));
    }
}
