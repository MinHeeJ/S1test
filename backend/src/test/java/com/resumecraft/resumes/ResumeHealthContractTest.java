package com.resumecraft.resumes;

import com.resumecraft.common.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ContextConfiguration(classes = ResumeCraftApplication.class)
@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class ResumeHealthContractTest {
    @Autowired MockMvc mvc;

    @Test void publicHealthPreservesFoundationEnvelope() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            assertThat(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8))
                .contains("operationId: getHealth", "operationId: updateResume");
        }
    }
}
