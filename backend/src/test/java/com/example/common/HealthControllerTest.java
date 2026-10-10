package com.example.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import jakarta.servlet.http.Cookie;
import org.yaml.snakeyaml.Yaml;
import java.util.Map;

@WebMvcTest(
    controllers = HealthController.class,
    excludeAutoConfiguration =
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class HealthControllerTest {
    @Autowired
    MockMvc mvc;

    @Test
    void anonymousHealthReturnsExactCommandEnvelopeAndBootstrapsCsrf() throws Exception {
        var result = mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {"success":true,"meta":{}}
                """, true))
            .andReturn();
        var cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.isHttpOnly()).isFalse();
        assertThat(cookie.getValue()).isNotBlank();
    }

    @Test
    void healthMatchesDurableOpenApiOperation() throws Exception {
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<String, Object> document = new Yaml().load(stream);
            var paths = (Map<?, ?>) document.get("paths");
            var path = (Map<?, ?>) paths.get("/api/health");
            var operation = (Map<?, ?>) path.get("get");
            assertThat(operation.get("operationId")).isEqualTo("getHealth");
            assertThat((java.util.List<?>) operation.get("security")).isEmpty();
        }
        mvc.perform(get("/api/health")).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.meta").isMap());
    }

    @Test
    void protectedReadWithoutSessionIs401NotRedirect() throws Exception {
        mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(header().doesNotExist("Location"));
    }

    @Test
    void publicSignupWithCsrfIsNotRejectedBySessionBoundary() throws Exception {
        // No auth controller in this foundation: passing security reaches the genuine missing route (404).
        Cookie token = mvc.perform(get("/api/health")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(token).isNotNull();
        mvc.perform(post("/api/auth/signup").cookie(token).header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isNotFound());
    }

    @Test
    void publicLoginWithCsrfIsNotRejectedBySessionBoundary() throws Exception {
        Cookie token = mvc.perform(get("/api/health")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(token).isNotNull();
        mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isNotFound());
    }

    @Test
    void loginStillRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/login"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"))
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void anonymousProtectedMutationRemains401EvenWithoutCsrf() throws Exception {
        mvc.perform(post("/api/photos"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
    }

    @Test
    @WithMockUser(roles = {})
    void authenticatedMutationWithoutCsrfIs403() throws Exception {
        mvc.perform(post("/api/photos"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
    }

    @Test
    @WithMockUser(roles = {})
    void spaCookieAndHeaderTokenAreAccepted() throws Exception {
        var result = mvc.perform(get("/api/health")).andReturn();
        Cookie token = result.getResponse().getCookie("XSRF-TOKEN");
        mvc.perform(post("/api/photos").cookie(token).header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isNotFound());
    }
}
