package com.resumecraft.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(SessionContextTest.SessionProbeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, HealthController.class,
        SessionContext.class, SessionContextTest.SessionProbeController.class})
class SessionContextTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;

    @Test
    void establishingAContextRotatesTheSessionAndMakesTheNextRequestAuthenticated() throws Exception {
        var session = new MockHttpSession();
        String originalId = session.getId();
        signIn(session);
        assertThat(session.getId()).isNotEqualTo(originalId);
        mvc.perform(get("/api/test/current-session").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").value("test-actor"));
        var token = mvc.perform(get("/api/health").session(session)).andReturn();
        assertThat(token.getResponse().getCookie("XSRF-TOKEN")).isNotNull();
    }

    @Test
    void clearingTheContextInvalidatesOnlyThisSessionAndRemovesItsCsrfCookie() throws Exception {
        var current = new MockHttpSession();
        var other = new MockHttpSession();
        signIn(current);
        signIn(other);
        var bootstrap = mvc.perform(get("/api/health").session(current)).andReturn();
        var meta = json.readTree(bootstrap.getResponse().getContentAsString()).path("meta");
        mvc.perform(post("/api/test/end-session").session(current)
                        .cookie(bootstrap.getResponse().getCookie("XSRF-TOKEN"))
                        .header(meta.path("csrfHeaderName").asText(), meta.path("csrfToken").asText()))
                .andExpect(status().isOk())
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(current.isInvalid()).isTrue();
        assertThat(other.isInvalid()).isFalse();
        mvc.perform(get("/api/test/current-session"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/test/current-session").session(other))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").value("test-actor"));
    }

    private void signIn(MockHttpSession session) throws Exception {
        var bootstrap = mvc.perform(get("/api/health").session(session)).andReturn();
        var meta = json.readTree(bootstrap.getResponse().getContentAsString()).path("meta");
        mvc.perform(post("/api/auth/login").session(session)
                        .cookie(bootstrap.getResponse().getCookie("XSRF-TOKEN"))
                        .header(meta.path("csrfHeaderName").asText(), meta.path("csrfToken").asText()))
                .andExpect(status().isOk()).andExpect(cookie().maxAge("XSRF-TOKEN", 0));
    }

    @RestController
    static class SessionProbeController {
        private final SessionContext sessions;

        SessionProbeController(SessionContext sessions) {
            this.sessions = sessions;
        }

        // Test-only actor; account verification belongs to the downstream auth controller.
        @PostMapping("/api/auth/login")
        ApiResponse<Void> login(HttpServletRequest request, HttpServletResponse response) {
            sessions.establish(UsernamePasswordAuthenticationToken.authenticated("test-actor", null, List.of()),
                    request, response);
            return ApiResponse.ok();
        }

        @GetMapping("/api/test/current-session")
        ApiResponse<String> current(Authentication actor) {
            return ApiResponse.ok(actor.getName());
        }

        @PostMapping("/api/test/end-session")
        ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
            sessions.clear(request, response);
            return ApiResponse.ok();
        }
    }
}
