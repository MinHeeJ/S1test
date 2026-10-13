package com.resumecraft.common;

import com.resumecraft.config.SecurityConfig;
import com.resumecraft.health.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
class HealthControllerTest {
    @Autowired MockMvc mvc;
    @MockBean DatabaseHealthMapper mapper;

    @Test
    void publicHealthReadsDatabaseAndBootstrapsCsrfWithoutBusinessData() throws Exception {
        when(mapper.ping()).thenReturn(1);
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
                .andExpect(cookie().exists("XSRF-TOKEN"));
        verify(mapper).ping();
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            java.util.Map<?, ?> contract = yaml.load(input);
            var paths = (java.util.Map<?, ?>) contract.get("paths");
            var health = (java.util.Map<?, ?>) paths.get("/api/health");
            var get = (java.util.Map<?, ?>) health.get("get");
            org.junit.jupiter.api.Assertions.assertEquals("getHealth", get.get("operationId"));
        }
    }

    @Test
    void failedDatabaseReturnsSafe503() throws Exception {
        when(mapper.ping()).thenThrow(new IllegalStateException("password secret SQL detail"));
        mvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("503"))
                .andExpect(jsonPath("$.field").value(nullValue()))
                .andExpect(jsonPath("$.message").value("서비스를 준비 중입니다."));
    }

    @Test
    void unexpectedProbeValueReturns503() throws Exception {
        when(mapper.ping()).thenReturn(0);
        mvc.perform(get("/api/health")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void anonymousProtectedReadReturns401() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.field").value(nullValue()));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousProtectedWritePrioritizes401OverCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", "1").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void authenticatedWriteStillRequiresCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", "1").with(user("owner")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(mapper);
    }
}
