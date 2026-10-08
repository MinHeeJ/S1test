package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Opt-in real PostgreSQL HTTP/persistence test; no context starts without supplied DB settings. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
@SpringBootTest
@AutoConfigureMockMvc
class AuthPersistenceTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> System.getenv("TEST_DB_URL"));
        registry.add("spring.datasource.username", () -> System.getenv("TEST_DB_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("TEST_DB_PASSWORD"));
    }

    @Test
    void signupDuplicateLoginLogoutAndReadbackUseRealUsers() throws Exception {
        String email = UUID.randomUUID() + "@example.dev";
        long before = db.queryForObject("SELECT COUNT(*) FROM users", Long.class);
        String signup = json.writeValueAsString(Map.of("email", email, "nickname", "새사용자",
                "password", "test-password"));
        try {
            var result = mvc.perform(post("/api/auth/signup").with(csrf())
                    .contentType("application/json").content(signup))
                    .andExpect(status().isCreated()).andReturn();
            var session = (MockHttpSession) result.getRequest().getSession(false);
            mvc.perform(get("/api/auth/me").session(session))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("새사용자"));
            assertThat(db.queryForObject("SELECT COUNT(*) FROM users", Long.class)).isEqualTo(before + 1);
            String hash = db.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
            assertThat(hash).isNotEqualTo("test-password");
            assertThat(passwords.matches("test-password", hash)).isTrue();
            mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json").content(signup))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
            assertThat(db.queryForObject("SELECT COUNT(*) FROM users", Long.class)).isEqualTo(before + 1);
            mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isOk());
            String login = json.writeValueAsString(Map.of("email", email, "password", "test-password"));
            var loggedIn = mvc.perform(post("/api/auth/login").with(csrf())
                    .contentType("application/json").content(login)).andExpect(status().isOk()).andReturn();
            mvc.perform(get("/api/auth/me").session((MockHttpSession) loggedIn.getRequest().getSession(false)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("새사용자"));
            assertThat(db.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email))
                    .isEqualTo(hash);
        } finally {
            db.update("DELETE FROM users WHERE email = ?", email);
        }
    }

    @Test
    void validationDoesNotWriteRealUsers() throws Exception {
        long before = db.queryForObject("SELECT COUNT(*) FROM users", Long.class);
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("""
                        {"email":"invalid","nickname":"새사용자","password":"test-password"}
                        """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        assertThat(db.queryForObject("SELECT COUNT(*) FROM users", Long.class)).isEqualTo(before);
    }
}
