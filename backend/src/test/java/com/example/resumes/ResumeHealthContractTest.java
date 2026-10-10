package com.example.resumes;

import com.example.common.ApiErrorHandler;
import com.example.common.HealthController;
import com.example.common.ResumeCraftApplication;
import com.example.common.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
    controllers = HealthController.class,
    excludeAutoConfiguration =
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@ContextConfiguration(classes = HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class ResumeHealthContractTest {
    @Autowired
    MockMvc mvc;

    @Test
    void anonymousHealthKeepsExactEnvelopeAndInitializesMutationToken() throws Exception {
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
            .andExpect(cookie().exists("XSRF-TOKEN"));
    }
}
