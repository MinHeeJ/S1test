package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ResumeCraftApplication;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Opt-in PostgreSQL HTTP/materialization tests, gated before application context creation. */
@EnabledIfEnvironmentVariable(named = "TEST_DATABASE_URL", matches = ".+")
@SpringBootTest(classes = ResumeCraftApplication.class)
@AutoConfigureMockMvc
class AuthDatabaseIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_DATABASE_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("TEST_DATABASE_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("TEST_DATABASE_PASSWORD"));
    }

    private Map<String, Object> snapshot() {
        return Map.of(
            "users", db.queryForList("SELECT * FROM users ORDER BY id"),
            "resumes", db.queryForList("SELECT * FROM resume ORDER BY id"),
            "photos", db.queryForList("""
                SELECT id, user_id, content_type, encode(data,'hex') AS bytes
                FROM photo ORDER BY id
                """)
        );
    }

    @Test
    void seedLoginAndLogoutLeaveEveryPersistedRowUnchanged() throws Exception {
        var before = snapshot();
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
            .andExpect(status().isNoContent()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("지우"));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void signupCommitsRealBcyrptAccountBeforeSessionAndDuplicatePreservesIt() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        var beforeResumes = db.queryForList("SELECT * FROM resume ORDER BY id");
        long beforePhotos = db.queryForObject("SELECT COUNT(*) FROM photo", Long.class);
        try {
            String body = json.writeValueAsString(
                Map.of("email", email, "nickname", "시험계정", "password", "password123"));
            var result = mvc.perform(post("/api/auth/signup").with(csrf())
                    .contentType("application/json").content(body))
                .andExpect(status().isNoContent()).andReturn();
            var persisted = db.queryForMap("SELECT id, password_hash FROM users WHERE email = ?", email);
            assertThat(persisted.get("id")).isInstanceOf(UUID.class);
            String hash = (String) persisted.get("password_hash");
            assertThat(hash).isNotEqualTo("password123");
            assertThat(passwords.matches("password123", hash)).isTrue();
            mvc.perform(get("/api/auth/me").session((MockHttpSession) result.getRequest().getSession(false)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("시험계정"));
            mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
            assertThat(db.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Long.class, email)).isEqualTo(1);
            assertThat(db.queryForList("SELECT * FROM resume ORDER BY id")).isEqualTo(beforeResumes);
            assertThat(db.queryForObject("SELECT COUNT(*) FROM photo", Long.class)).isEqualTo(beforePhotos);
        } finally {
            db.update("DELETE FROM users WHERE email = ?", email);
        }
    }

    @Test
    void invalidSignupNeverWritesRealDatabase() throws Exception {
        var before = snapshot();
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("{\"email\":\"abc@\",\"nickname\":\"시험계정\",\"password\":\"password123\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        assertThat(snapshot()).isEqualTo(before);
    }
}
