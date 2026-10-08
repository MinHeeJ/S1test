package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class SessionBoundaryTest {
    @Autowired
    MockMvc mvc;

    @Test
    void protectedReadWithoutSessionHasFlat401() throws Exception {
        mvc.perform(get("/api/resumes"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("Unauthorized"))
            .andExpect(jsonPath("$.message").value("Unauthorized"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void anonymousMeBootstrapsUsableCsrfToken() throws Exception {
        var bootstrap = mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(header().exists("X-CSRF-TOKEN"))
            .andExpect(header().string("X-CSRF-HEADER", "X-CSRF-TOKEN"))
            .andReturn();
        assertThat(bootstrap.getRequest().getSession(false)).isNotNull();
        // Login is not implemented in this slice: 404 proves admission rather than a fake login success.
        mvc.perform(post("/api/auth/login")
                .session((org.springframework.mock.web.MockHttpSession) bootstrap.getRequest().getSession(false))
                .header("X-CSRF-TOKEN", bootstrap.getResponse().getHeader("X-CSRF-TOKEN")))
            .andExpect(status().isNotFound());
    }

    @Test
    void signupWithoutCsrfIsForbidden() throws Exception {
        mvc.perform(post("/api/auth/signup"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("Forbidden"));
    }

    @Test
    void loginWithoutCsrfIsForbidden() throws Exception {
        mvc.perform(post("/api/auth/login"))
            .andExpect(status().isForbidden());
    }

    @Test
    void signupWithCsrfIsAdmittedWithoutSession() throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()))
            .andExpect(status().isNotFound());
    }

    @Test
    void authenticatedMutationStillRequiresCsrf() throws Exception {
        mvc.perform(put("/api/resumes/00000000-0000-0000-0000-000000000001").with(user("owner")))
            .andExpect(status().isForbidden());
    }
}
