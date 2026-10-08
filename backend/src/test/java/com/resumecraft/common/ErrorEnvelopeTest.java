package com.resumecraft.common;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ErrorEnvelopeTest extends CommonMvcSupport {
    @Test
    void successHasMetaAndOmitsUnspecifiedData() throws Exception {
        mvc.perform(get("/api/common-contract").with(user("actor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void designatedConflictKeepsTopLevelCodeAndWireField() throws Exception {
        mvc.perform(get("/api/common-contract").param("outcome", "conflict").with(user("actor")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다."))
                .andExpect(jsonPath("$.field").value("email"))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void notFoundHasExplicitNullField() throws Exception {
        mvc.perform(get("/api/common-contract").param("outcome", "missing").with(user("actor")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(content().string(containsString("\"field\":null")));
    }

    @Test
    void beanValidationReturnsFieldWithoutRejectedValue() throws Exception {
        mvc.perform(post("/api/common-contract").with(user("actor")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("title"))
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test
    void malformedJsonIsSafeBadRequest() throws Exception {
        mvc.perform(post("/api/common-contract").with(user("actor")).with(csrf())
                        .contentType("application/json").content("not-json-password"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(not(containsString("not-json-password"))));
    }

    @Test
    void unexpectedFailureDoesNotLeakSensitiveInternalDetails() throws Exception {
        mvc.perform(get("/api/common-contract").param("outcome", "unexpected").with(user("actor")))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(content().string(not(containsString("password_hash"))))
                .andExpect(content().string(not(containsString("SELECT"))))
                .andExpect(content().string(not(containsString("jdbc:"))));
    }

    @Test
    void classpathContractRequiredEnvelopeFieldsMatchHttpBehavior() throws Exception {
        Map<String, Object> document;
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            document = new Yaml().load(stream);
        }
        var components = (Map<?, ?>) document.get("components");
        var schemas = (Map<?, ?>) components.get("schemas");
        var error = (Map<?, ?>) schemas.get("ApiError");
        var success = (Map<?, ?>) schemas.get("ApiResponse");
        var mapper = context.getBean(com.fasterxml.jackson.databind.ObjectMapper.class);
        var errorBody = mapper.readTree(mvc.perform(get("/api/common-contract"))
                .andReturn().getResponse().getContentAsString());
        var successBody = mapper.readTree(mvc.perform(get("/api/common-contract").with(user("actor")))
                .andReturn().getResponse().getContentAsString());
        for (Object field : (Iterable<?>) error.get("required")) assertThat(errorBody.has(field.toString())).isTrue();
        for (Object field : (Iterable<?>) success.get("required")) {
            assertThat(successBody.has(field.toString())).isTrue();
        }
    }
}
