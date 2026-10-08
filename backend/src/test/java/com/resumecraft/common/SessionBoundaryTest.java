package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SessionBoundaryTest.BoundaryController.class)
@Import({SecurityConfig.class, SessionBoundaryTest.BoundaryController.class})
class SessionBoundaryTest {
    @Autowired MockMvc mvc;

    @RestController
    static class BoundaryController {
        @PostMapping({"/api/auth/signup", "/api/auth/login", "/api/resumes"})
        ApiResponse<Void> mutation() {
            return ApiResponse.ok();
        }
    }

    @Test
    void publicAuthenticationStillRequiresCsrf() throws Exception {
        for (String path : new String[]{"/api/auth/signup", "/api/auth/login"}) {
            mvc.perform(post(path)).andExpect(status().isForbidden());
            mvc.perform(post(path).with(csrf())).andExpect(status().isOk());
        }
    }

    @Test
    void anonymousMutationIsUnauthorizedEvenWithoutCsrf() throws Exception {
        mvc.perform(post("/api/resumes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/resumes").with(csrf())).andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void authenticatedMutationRequiresCsrf() throws Exception {
        mvc.perform(post("/api/resumes")).andExpect(status().isForbidden());
        mvc.perform(post("/api/resumes").with(csrf())).andExpect(status().isOk());
    }

    @Test
    void realCookieHeaderPairIsAccepted() throws Exception {
        var result = mvc.perform(get("/api/auth/login")).andReturn();
        var token = result.getResponse().getCookie("XSRF-TOKEN");
        org.assertj.core.api.Assertions.assertThat(token).isNotNull();
        mvc.perform(post("/api/auth/login").cookie(token).header("X-XSRF-TOKEN", token.getValue()))
                .andExpect(status().isOk());
    }
}
