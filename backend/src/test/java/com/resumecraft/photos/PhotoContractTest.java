package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiErrorHandler;
import com.resumecraft.common.SecurityConfig;
import com.resumecraft.common.SessionUser;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PhotoController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, PhotoService.class})
class PhotoContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper mapper;
    private final UUID owner = UUID.randomUUID();

    static byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    private UsernamePasswordAuthenticationToken identity(UUID id) {
        return UsernamePasswordAuthenticationToken.authenticated(
            new SessionUser(id, "photo-test@example.test", "사진시험"), null, List.of());
    }

    @ParameterizedTest
    @ValueSource(strings = {"png", "jpeg"})
    void uploadReturnsUuidAndOwnedOriginal(String format) throws Exception {
        assertThat(new ClassPathResource("contracts/openapi.yaml").exists()).isTrue();
        byte[] bytes = image(format);
        var file = new MockMultipartFile("file", "portrait." + format, "image/" + format, bytes);
        var result = mvc.perform(multipart("/api/photos").file(file)
                .with(authentication(identity(owner))).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isEmpty())
            .andReturn();
        UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsString())
            .path("data").path("photoId").asText());
        var captured = ArgumentCaptor.forClass(Photo.class);
        verify(mapper).insert(captured.capture());
        Photo photo = captured.getValue();
        assertThat(photo.id()).isEqualTo(id);
        assertThat(photo.userId()).isEqualTo(owner);
        assertThat(photo.contentType()).isEqualTo("image/" + format);
        assertThat(photo.data()).isEqualTo(bytes);
        when(mapper.findOwned(id, owner)).thenReturn(photo);
        mvc.perform(get("/api/photos/{id}", id).with(authentication(identity(owner))))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/" + format))
            .andExpect(content().bytes(bytes))
            .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void anonymousUploadAndDownloadNeverReachPersistence() throws Exception {
        mvc.perform(multipart("/api/photos").file(new MockMultipartFile(
                "file", "photo.png", "image/png", image("png"))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void authenticatedUploadStillNeedsCsrf() throws Exception {
        mvc.perform(multipart("/api/photos").file(new MockMultipartFile(
                "file", "photo.png", "image/png", image("png")))
                .with(authentication(identity(owner))))
            .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void anotherOwnerGets404WithoutImage() throws Exception {
        UUID id = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        when(mapper.findOwned(id, owner)).thenReturn(new Photo(id, owner, "image/png", image("png")));
        mvc.perform(get("/api/photos/{id}", id).with(authentication(identity(other))))
            .andExpect(status().isNotFound())
            .andExpect(content().contentTypeCompatibleWith("application/json"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        verify(mapper).findOwned(id, other);
    }

    @Test
    void absentPhotoIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(authentication(identity(owner))))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unsupportedTypeCannotWrite() throws Exception {
        rejected("text/plain", "text".getBytes(), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void renamedFileCannotWrite() throws Exception {
        rejected("image/png", "not an image".getBytes(), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void mediaTypeMustMatchActualImage() throws Exception {
        rejected("image/jpeg", image("png"), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void truncatedImageCannotWrite() throws Exception {
        rejected("image/png", Arrays.copyOf(image("png"), 30), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void overDecimalLimitCannotWrite() throws Exception {
        rejected("image/png", Arrays.copyOf(image("png"), 2_000_001), 413, "FILE_TOO_LARGE");
    }

    @Test
    void exactDecimalLimitIsAcceptedAndPreserved() throws Exception {
        byte[] bytes = Arrays.copyOf(image("png"), 2_000_000);
        mvc.perform(multipart("/api/photos").file(new MockMultipartFile("file", "p.png", "image/png", bytes))
                .with(authentication(identity(owner))).with(csrf()))
            .andExpect(status().isCreated());
        var captured = ArgumentCaptor.forClass(Photo.class);
        verify(mapper).insert(captured.capture());
        assertThat(captured.getValue().data()).isEqualTo(bytes);
    }

    @Test
    void missingFileIsSafe400() throws Exception {
        mvc.perform(multipart("/api/photos").with(authentication(identity(owner))).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        verifyNoInteractions(mapper);
    }

    private void rejected(String type, byte[] bytes, int statusCode, String code) throws Exception {
        mvc.perform(multipart("/api/photos").file(new MockMultipartFile("file", "portrait.png", type, bytes))
                .with(authentication(identity(owner))).with(csrf()))
            .andExpect(status().is(statusCode))
            .andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        verifyNoInteractions(mapper);
    }
}
