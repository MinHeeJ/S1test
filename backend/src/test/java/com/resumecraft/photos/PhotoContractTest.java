package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiErrorHandler;
import com.resumecraft.common.SecurityConfig;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringJUnitConfig(PhotoContractTest.WebConfig.class)
@WebAppConfiguration
class PhotoContractTest {
    @Autowired WebApplicationContext context;
    @Autowired PhotoMapper mapper;
    @Autowired ObjectMapper json;
    MockMvc mvc;
    Map<UUID, PhotoRow> rows;
    UUID owner = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        reset(mapper);
        rows = new HashMap<>();
        when(mapper.insert(any())).thenAnswer(call -> {
            PhotoRow row = call.getArgument(0);
            rows.put(row.id(), row);
            return 1;
        });
        when(mapper.findOwned(any(), any())).thenAnswer(call -> {
            PhotoRow row = rows.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1)) ? row : null;
        });
    }

    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ApiErrorHandler.class, PhotoController.class, PhotoService.class})
    static class WebConfig {
        @Bean ObjectMapper objectMapper() {
            return new ObjectMapper().findAndRegisterModules();
        }
        @Bean PhotoMapper photoMapper() {
            return mock(PhotoMapper.class);
        }
    }

    static byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    UUID upload(byte[] bytes, String type) throws Exception {
        var result = mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("file", "photo", type, bytes))
                        .with(user(owner.toString())).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap())
                .andReturn();
        return UUID.fromString(json.readTree(result.getResponse().getContentAsString()).at("/data/photoId").asText());
    }

    @Test
    void pngUploadReadbackPreservesOriginalAndSessionOwner() throws Exception {
        byte[] bytes = image("png");
        UUID id = upload(bytes, "image/png");
        assertThat(rows.get(id).data()).isEqualTo(bytes);
        assertThat(rows.get(id).userId()).isEqualTo(owner);
        assertThat(rows.get(id).contentType()).isEqualTo("image/png");
        mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
                .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(bytes)).andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void jpegUploadReadbackPreservesOriginal() throws Exception {
        byte[] bytes = image("jpg");
        UUID id = upload(bytes, "image/jpeg");
        mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
                .andExpect(status().isOk()).andExpect(content().contentType("image/jpeg"))
                .andExpect(content().bytes(bytes));
    }

    @Test
    void exactDecimalLimitIsAccepted() throws Exception {
        UUID id = upload(Arrays.copyOf(image("png"), 2_000_000), "image/png");
        assertThat(rows.get(id).data()).hasSize(2_000_000);
    }

    @Test
    void oversizedUploadAddsNoRow() throws Exception {
        reject(new byte[2_000_001], "image/png", 413, "FILE_TOO_LARGE");
    }

    @Test
    void unsupportedMediaAddsNoRow() throws Exception {
        reject(image("png"), "image/gif", 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void renamedTextAddsNoRow() throws Exception {
        reject("not an image".getBytes(), "image/png", 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void decodedMediaMustMatchDeclaredType() throws Exception {
        reject(image("jpg"), "image/png", 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    void missingFileIsBadRequest() throws Exception {
        mvc.perform(multipart("/api/photos").with(user(owner.toString())).with(csrf()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        verifyNoInteractions(mapper);
    }

    void reject(byte[] bytes, String type, int statusCode, String code) throws Exception {
        mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("file", "photo.png", type, bytes))
                        .with(user(owner.toString())).with(csrf()))
                .andExpect(status().is(statusCode))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.field").value("file"));
        assertThat(rows).isEmpty();
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousUploadIs401WithoutInsert() throws Exception {
        mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("file", "photo.png", "image/png", image("png"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(mapper);
    }

    @Test
    void authenticatedUploadRequiresCsrf() throws Exception {
        mvc.perform(multipart("/api/photos")
                        .file(new MockMultipartFile("file", "photo.png", "image/png", image("png")))
                        .with(user(owner.toString())))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignPhotoIs404WithoutBytes() throws Exception {
        UUID id = upload(image("png"), "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(user(UUID.randomUUID().toString())))
                .andExpect(status().isNotFound()).andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows).hasSize(1);
    }

    @Test
    void absentPhotoIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user(owner.toString())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void anonymousGetIs401WithoutReadingStorage() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void durableContractIsLoadedAndDeclaresBinaryAndMultipartOperations() throws Exception {
        String contract = new ClassPathResource("contracts/openapi.yaml")
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(contract).contains("operationId: uploadPhoto", "operationId: getPhoto", "multipart/form-data");
        UUID id = upload(image("png"), "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(user(owner.toString())))
                .andExpect(content().contentType("image/png"));
    }
}
