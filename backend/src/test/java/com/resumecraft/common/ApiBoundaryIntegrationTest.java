package com.resumecraft.common;

import com.resumecraft.security.SecurityConfig;
import com.resumecraft.security.SessionAuthentication;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({HtmlCsrfController.class, ApiBoundaryIntegrationTest.BoundaryProbe.class})
@Import({SecurityConfig.class, SessionAuthentication.class, ApiExceptionHandler.class,
    ApiBoundaryIntegrationTest.BoundaryProbe.class, HtmlCsrfService.class})
class ApiBoundaryIntegrationTest {
    @Autowired MockMvc mvc;

    // These handlers belong only to this test; they exercise session infrastructure, not auth business behavior.
    @RestController
    static class BoundaryProbe {
        private final SessionAuthentication sessions;

        BoundaryProbe(SessionAuthentication sessions) {
            this.sessions = sessions;
        }

        @PostMapping("/api/auth/login")
        void sessionProbe(HttpServletRequest request, HttpServletResponse response) {
            sessions.establish(request, response, UUID.fromString("10000000-0000-4000-8000-000000000001"));
        }

        @GetMapping("/api/session-probe")
        ApiResponse<String> owner() {
            return ApiResponse.of(CurrentUserId.require().toString());
        }

        @PostMapping("/api/auth/logout")
        void clear(HttpServletRequest request, HttpServletResponse response) {
            sessions.clear(request, response);
        }
    }

    @Test
    void anonymousReadIs401WithTopLevelError() throws Exception {
        mvc.perform(get("/api/resumes"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void anonymousWriteIs401BeforeCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void signupStillRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/signup")).andExpect(status().isForbidden());
    }

    @Test
    void loginStillRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/login")).andExpect(status().isForbidden());
    }

    @Test
    void htmlCookieLoginRotationAndSameSessionRead() throws Exception {
        var bootstrap = mvc.perform(get("/")).andExpect(status().isNoContent()).andReturn();
        Cookie token = bootstrap.getResponse().getCookie("XSRF-TOKEN");
        assertThat(token).isNotNull();
        assertThat(token.isHttpOnly()).isFalse();
        var session = new MockHttpSession();
        String previousId = session.getId();
        mvc.perform(post("/api/auth/login").session(session).cookie(token)
                .header("X-XSRF-TOKEN", token.getValue()))
            .andExpect(status().isOk());
        assertThat(session.getId()).isNotEqualTo(previousId);
        mvc.perform(get("/api/session-probe").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data").value("10000000-0000-4000-8000-000000000001"));
        var refreshed = mvc.perform(get("/").session(session)).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(refreshed).isNotNull();
        mvc.perform(post("/api/auth/logout").session(session).cookie(refreshed)
                .header("X-XSRF-TOKEN", refreshed.getValue()))
            .andExpect(status().isOk());
        mvc.perform(get("/api/session-probe")).andExpect(status().isUnauthorized());
    }
}
