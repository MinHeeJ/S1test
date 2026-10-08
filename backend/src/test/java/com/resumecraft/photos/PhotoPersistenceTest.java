package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.SessionUser;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// PostgreSQL-only opt-in follows the foundation's pre-context environment gate.
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@SpringBootTest
@AutoConfigureMockMvc
class PhotoPersistenceTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("TEST_DB_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("TEST_DB_PASSWORD"));
    }

    @Test
    void httpUploadNativeUuidByteaAndOwnerQueryRoundTrip() throws Exception {
        UUID owner = db.queryForObject("SELECT id FROM users WHERE email = 'jiwoo@resume.dev'", UUID.class);
        UUID other = db.queryForObject("SELECT id FROM users WHERE email = 'minjun@resume.dev'", UUID.class);
        var auth = UsernamePasswordAuthenticationToken.authenticated(
            new SessionUser(owner, "jiwoo@resume.dev", "지우"), null, List.of());
        byte[] bytes = PhotoContractTest.image("png");
        var result = mvc.perform(multipart("/api/photos").file(
                new MockMultipartFile("file", "portrait.png", "image/png", bytes))
                .with(authentication(auth)).with(csrf()))
            .andExpect(status().isCreated()).andReturn();
        UUID id = UUID.fromString(json.readTree(result.getResponse().getContentAsString())
            .path("data").path("photoId").asText());
        try {
            db.query("SELECT user_id, content_type, data FROM photo WHERE id = ?", row -> {
                assertThat(row.getObject("user_id", UUID.class)).isEqualTo(owner);
                assertThat(row.getString("content_type")).isEqualTo("image/png");
                assertThat(row.getBytes("data")).isEqualTo(bytes);
            }, id);
            mvc.perform(get("/api/photos/{id}", id).with(authentication(auth)))
                .andExpect(status().isOk()).andExpect(content().bytes(bytes));
            var otherAuth = UsernamePasswordAuthenticationToken.authenticated(
                new SessionUser(other, "minjun@resume.dev", "민준"), null, List.of());
            mvc.perform(get("/api/photos/{id}", id).with(authentication(otherAuth)))
                .andExpect(status().isNotFound());
            assertThat(db.queryForObject("SELECT data FROM photo WHERE id = ?", byte[].class, id))
                .isEqualTo(bytes);
        } finally {
            db.update("DELETE FROM photo WHERE id = ?", id);
        }
    }
}
