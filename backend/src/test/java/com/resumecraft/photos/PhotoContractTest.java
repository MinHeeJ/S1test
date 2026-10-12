package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.common.SecurityConfig;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
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
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controller/security/service with a stateful persistence boundary, not proof of SQL durability. */
@WebMvcTest(PhotoController.class)
@org.springframework.test.context.ContextConfiguration(classes = com.resumecraft.common.ResumeCraftApplication.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, PhotoService.class})
class PhotoContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper mapper;
    private final UUID owner = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final Map<UUID, Photo> stored = new HashMap<>();

    @BeforeEach
    void persistenceBoundary() {
        stored.clear();
        when(mapper.selectUserId(owner.toString())).thenReturn(owner);
        when(mapper.selectUserId(other.toString())).thenReturn(other);
        when(mapper.insert(any(Photo.class))).thenAnswer(call -> {
            Photo photo = call.getArgument(0);
            stored.put(photo.id(), photo);
            return 1;
        });
        when(mapper.findOwned(any(UUID.class), any(UUID.class))).thenAnswer(call -> {
            Photo photo = stored.get(call.getArgument(0));
            return photo != null && photo.userId().equals(call.getArgument(1)) ? photo : null;
        });
    }

    private byte[] image(String format) throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, out);
        return out.toByteArray();
    }

    // Literal POST with a multipart servlet request, before applying actor/CSRF processors.
    private MockHttpServletRequestBuilder upload(MockMultipartFile file) {
        return post("/api/photos").contentType(MediaType.MULTIPART_FORM_DATA).with(request -> {
            var multipart = new MockMultipartHttpServletRequest(request.getServletContext());
            multipart.setContextPath(request.getContextPath());
            multipart.setMethod(request.getMethod());
            multipart.setRequestURI(request.getRequestURI());
            multipart.setServletPath(request.getServletPath());
            multipart.setContentType(request.getContentType());
            if (file != null) {
                multipart.addFile(file);
            }
            return multipart;
        });
    }

    private String uploadImage(String format, String mime, byte[] bytes) throws Exception {
        var response = mvc.perform(upload(new MockMultipartFile("file", "portrait." + format, mime, bytes))
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.photoId").isString())
            .andReturn().getResponse();
        return json.readTree(response.getContentAsString()).path("data").path("photoId").asText();
    }

    @Test
    void uploadJpegThenGetReturnsOriginal() throws Exception {
        byte[] bytes = image("jpg");
        String id = uploadImage("jpg", "image/jpeg", bytes);
        assertThat(stored.get(UUID.fromString(id)).userId()).isEqualTo(owner);
        mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/jpeg"))
            .andExpect(content().bytes(bytes))
            .andExpect(header().string("Cache-Control", "no-store"));
        verify(mapper, times(1)).insert(any(Photo.class));
    }

    @Test
    void uploadPngPreservesBytesMimeOwnerAndCreationTime() throws Exception {
        byte[] bytes = image("png");
        String id = uploadImage("png", "image/png", bytes);
        Photo photo = stored.get(UUID.fromString(id));
        assertThat(photo.userId()).isEqualTo(owner);
        assertThat(photo.contentType()).isEqualTo("image/png");
        assertThat(photo.data()).isEqualTo(bytes);
        assertThat(photo.createdAt().getOffset().getTotalSeconds()).isZero();
        mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
    }

    @Test
    void anonymousUploadCannotInsert() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", image("jpg"))).with(csrf()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void uploadRequiresCsrf() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", image("jpg"))).with(user(owner.toString())))
            .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousGetDoesNotReadPersistence() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void otherUserGets404AndCannotChangePhoto() throws Exception {
        String id = uploadImage("png", "image/png", image("png"));
        Photo before = stored.get(UUID.fromString(id));
        mvc.perform(get("/api/photos/{id}", id).with(user(other.toString())))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.field").isEmpty());
        assertThat(stored.get(UUID.fromString(id))).isSameAs(before);
        verify(mapper, times(1)).insert(any(Photo.class));
    }

    @Test
    void nonexistentPhotoIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user(owner.toString())))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap());
        verify(mapper, never()).insert(any());
    }

    @Test
    void malformedPhotoIdentityIs404WithoutQuery() throws Exception {
        mvc.perform(get("/api/photos/{id}", "not-a-uuid").with(user(owner.toString())))
            .andExpect(status().isNotFound());
        verify(mapper, never()).findOwned(any(), any());
    }

    @Test
    void unsupportedGifCannotReplaceExistingPhoto() throws Exception {
        String id = uploadImage("jpg", "image/jpeg", image("jpg"));
        Photo before = stored.get(UUID.fromString(id));
        mvc.perform(upload(new MockMultipartFile("file", "portrait.gif", "image/gif", image("gif")))
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
            .andExpect(jsonPath("$.field").value("file"));
        assertThat(stored).hasSize(1);
        assertThat(stored.get(UUID.fromString(id))).isSameAs(before);
    }

    @Test
    void oversizedJpegCannotInsert() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", "portrait.jpg", "image/jpeg", new byte[2_000_001]))
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().is(413))
            .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"))
            .andExpect(jsonPath("$.field").value("file"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void exactDecimalByteLimitIsAccepted() throws Exception {
        byte[] bytes = java.util.Arrays.copyOf(image("jpg"), 2_000_000);
        String id = uploadImage("jpg", "image/jpeg", bytes);
        assertThat(stored.get(UUID.fromString(id)).data()).isEqualTo(bytes);
    }

    @Test
    void mimeMustMatchActualDecoderFormat() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", "portrait.jpg", "image/jpeg", image("png")))
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void corruptImageCannotInsert() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", "portrait.png", "image/png", new byte[]{1, 2, 3}))
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("file"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void missingFileIs400() throws Exception {
        mvc.perform(upload(null).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("file"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void emptyFileIs400() throws Exception {
        mvc.perform(upload(new MockMultipartFile("file", new byte[0])).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("file"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void unexpectedPersistenceErrorNeverLeaksSql() throws Exception {
        when(mapper.findOwned(any(), any())).thenThrow(new IllegalStateException("password_hash SQL secret"));
        var result = mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user(owner.toString())))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("SQL", "secret", "password_hash");
    }

    @Test
    void classpathContractDeclaresObservedPhotoStatuses() throws Exception {
        var options = new org.yaml.snakeyaml.LoaderOptions();
        options.setMaxAliasesForCollections(1000);
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<?, ?> contract = new org.yaml.snakeyaml.Yaml(options).load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> post = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos")).get("post");
            Map<?, ?> get = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos/{id}")).get("get");
            assertThat(post.get("operationId")).isEqualTo("uploadPhoto");
            assertThat(get.get("operationId")).isEqualTo("getPhoto");
            assertThat(((Map<?, ?>) post.get("responses")).keySet().toString()).contains("201", "400", "413");
            String id = uploadImage("png", "image/png", image("png"));
            mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
                .andExpect(status().isOk()).andExpect(content().contentType("image/png"));
        }
    }
}
