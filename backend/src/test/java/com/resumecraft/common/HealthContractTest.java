package com.resumecraft.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class HealthContractTest {
    @Autowired
    private MockMvc mvc;

    @Test
    void anonymousHealthReturnsSuccessAndCsrfBootstrap() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta.csrfToken").isNotEmpty())
                .andExpect(jsonPath("$.meta.csrfHeaderName").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(cookie().exists("XSRF-TOKEN"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void classpathContractDeclaresPublicHealthAndMatchesItsRequiredEnvelope() throws Exception {
        Map<String, Object> contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new Yaml().load(input);
        }
        var paths = (Map<String, Object>) contract.get("paths");
        var operation = (Map<String, Object>) ((Map<String, Object>) paths.get("/api/health")).get("get");
        assertThat(operation.get("operationId")).isEqualTo("getHealth");
        assertThat(operation.get("security")).isEqualTo(java.util.List.of());
        var components = (Map<String, Object>) contract.get("components");
        var schemas = (Map<String, Object>) components.get("schemas");
        var response = (Map<String, Object>) schemas.get("ApiResponse");
        assertThat((java.util.List<String>) response.get("required")).containsExactly("success", "meta");
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap());
    }
}
