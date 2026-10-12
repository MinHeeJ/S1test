package com.resumecraft.common;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class SessionBoundaryTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;

    @Test
    void protectedReadRejectsAnonymousWithoutRedirect() throws Exception {
        mvc.perform(get("/api/resumes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.field").isEmpty())
                .andExpect(header().doesNotExist("Location"));
    }

    @Test
    void protectedAnonymousMutationReturnsAuthenticationErrorEvenWithoutCsrf() throws Exception {
        mvc.perform(put("/api/resumes/7").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("401"));
    }

    @Test
    void authenticatedMutationWithoutCsrfIsForbidden() throws Exception {
        mvc.perform(put("/api/resumes/7").with(user("session-actor"))
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("403"))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void signupIsPublicButRequiresCsrfAndBootstrapHeaderPassesSecurity() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        var bootstrap = mvc.perform(get("/api/health")).andReturn();
        var meta = json.readTree(bootstrap.getResponse().getContentAsString()).path("meta");
        // No signup controller exists in foundation: 404 proves admission, not signup behavior.
        mvc.perform(post("/api/auth/signup")
                        .cookie(bootstrap.getResponse().getCookie("XSRF-TOKEN"))
                        .header(meta.path("csrfHeaderName").asText(), meta.path("csrfToken").asText())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
    }

    @Test
    void loginBootstrapPassesSecurityWithoutAuthentication() throws Exception {
        var bootstrap = mvc.perform(get("/api/health")).andReturn();
        var meta = json.readTree(bootstrap.getResponse().getContentAsString()).path("meta");
        mvc.perform(post("/api/auth/login")
                        .cookie(bootstrap.getResponse().getCookie("XSRF-TOKEN"))
                        .header(meta.path("csrfHeaderName").asText(), meta.path("csrfToken").asText())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
    }
}
