package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;

@WebMvcTest(HealthController.class)
@Import(SecurityConfig.class)
class HealthContractTest {
    @Autowired MockMvc mvc;

    @Test
    void publicLivenessHasOnlyContractedEnvelope() throws Exception {
        assertThat(new ClassPathResource("contracts/openapi.yaml").exists()).isTrue();
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"success":true,"meta":{}}
                        """, true))
                .andExpect(cookie().exists("XSRF-TOKEN"));
    }

    @Test
    void unauthenticatedProtectedReadIsJsonNotRedirect() throws Exception {
        mvc.perform(get("/api/resumes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(header().doesNotExist("Location"));
    }
}
