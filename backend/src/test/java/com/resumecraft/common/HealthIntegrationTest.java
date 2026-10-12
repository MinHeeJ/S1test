package com.resumecraft.common;

import com.resumecraft.health.HealthController;
import com.resumecraft.health.HealthService;
import com.resumecraft.security.SecurityConfig;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
class HealthIntegrationTest {
    @Autowired MockMvc mvc;
    @MockBean HealthService health;

    @Test
    void publicHealthUsesApprovedEnvelopeWithoutBusinessData() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(10000);
            Map<?, ?> contract = new Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options)).load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> endpoint = (Map<?, ?>) paths.get("/api/health");
            assertThat(((Map<?, ?>) endpoint.get("get")).get("operationId")).isEqualTo("getHealth");
        }
        mvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data").doesNotExist());
        verify(health).requireReady();
    }

    @Test
    void readinessFailureIs503AndDoesNotLeakDatabaseDetails() throws Exception {
        doThrow(new DomainException(HttpStatus.SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE", "서비스 준비가 완료되지 않았습니다.")).when(health).requireReady();
        mvc.perform(get("/api/health"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
    }
}
