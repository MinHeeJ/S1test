package com.resumecraft.common;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

class SessionBoundaryTest extends CommonMvcSupport {
    @Test
    void anonymousProtectedReadHasUnauthorizedEnvelope() throws Exception {
        mvc.perform(get("/api/common-contract"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meBootstrapIssuesCsrfOn401AndTokenAllowsPublicPostToReachMvc() throws Exception {
        var bootstrap = mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-CSRF-TOKEN"))
                .andReturn();
        var session = (MockHttpSession) bootstrap.getRequest().getSession(false);
        assertThat(session).isNotNull();
        mvc.perform(post("/api/auth/signup").session(session)
                        .header("X-CSRF-TOKEN", bootstrap.getResponse().getHeader("X-CSRF-TOKEN")))
                .andExpect(status().isNotFound()); // Business controller belongs to the auth step.
    }

    @Test
    void publicLoginAcceptsBootstrapTokenWithoutLogin() throws Exception {
        var bootstrap = mvc.perform(get("/api/auth/me")).andReturn();
        mvc.perform(post("/api/auth/login")
                        .session((MockHttpSession) bootstrap.getRequest().getSession(false))
                        .header("X-CSRF-TOKEN", bootstrap.getResponse().getHeader("X-CSRF-TOKEN")))
                .andExpect(status().isNotFound());
    }

    @Test
    void publicAuthStillRejectsMissingCsrf() throws Exception {
        mvc.perform(post("/api/auth/signup"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void authenticatedWriteWithoutCsrfIsForbidden() throws Exception {
        mvc.perform(post("/api/common-contract").with(user(UUID.randomUUID().toString()))
                        .contentType("application/json").content("{\"title\":\"제목\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void sessionEstablishmentRotatesIdAndStoresContextForNextHttpRequest() throws Exception {
        var request = new MockHttpServletRequest(context.getServletContext());
        var session = new MockHttpSession(context.getServletContext());
        request.setSession(session);
        String previousId = session.getId();
        var response = new MockHttpServletResponse();
        var principalId = UUID.randomUUID();
        var authentication = new UsernamePasswordAuthenticationToken(principalId.toString(), null, List.of());
        var sessions = new SessionAuthentication(context.getBean(SecurityContextRepository.class));
        try {
            sessions.establish(authentication, request, response);
            assertThat(session.getId()).isNotEqualTo(previousId);
            assertThat(SessionAuthentication.userId(authentication)).isEqualTo(principalId);
            SecurityContextHolder.clearContext();
            mvc.perform(get("/api/common-contract").session(session))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
            sessions.logout(request, response, authentication);
            assertThat(session.isInvalid()).isTrue();
            assertThat(response.getCookie("JSESSIONID").getMaxAge()).isZero();
            mvc.perform(get("/api/common-contract")).andExpect(status().isUnauthorized());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
