package com.resumecraft.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@WebMvcTest(SessionAuthenticationTest.SessionController.class)
@Import({SecurityConfig.class, SessionAuthentication.class, SessionAuthenticationTest.SessionController.class})
class SessionAuthenticationTest {
    @Autowired MockMvc mvc;

    @RestController
    static class SessionController {
        private final SessionAuthentication sessions;

        SessionController(SessionAuthentication sessions) {
            this.sessions = sessions;
        }

        @PostMapping("/api/auth/login")
        ApiResponse<Void> login(HttpServletRequest request, HttpServletResponse response) {
            sessions.authenticate(new SessionUser(
                    UUID.fromString("03b83012-3722-4f94-bbef-7d37a1a3cd1c"), "test@example.dev", "시험"),
                    request, response);
            return ApiResponse.ok();
        }

        @GetMapping("/api/session-identity")
        ApiResponse<String> identity(@org.springframework.security.core.annotation.AuthenticationPrincipal
                SessionUser user) {
            return ApiResponse.of(user.nickname());
        }
    }

    @Test
    void sessionIsRotatedAndPrincipalIsPersistedForNextHttpRequest() throws Exception {
        var session = new MockHttpSession();
        String previous = session.getId();
        mvc.perform(post("/api/auth/login").session(session).with(csrf()))
                .andExpect(status().isOk());
        assertThat(session.getId()).isNotEqualTo(previous);
        mvc.perform(get("/api/session-identity").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("시험"));
        mvc.perform(get("/api/session-identity"))
                .andExpect(status().isUnauthorized());
    }
}
