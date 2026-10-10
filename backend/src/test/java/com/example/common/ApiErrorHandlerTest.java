package com.example.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

class ApiErrorHandlerTest {
    MockMvc mvc;

    @BeforeEach
    void configureRealAdviceWithTestOnlyBoundary() {
        mvc = MockMvcBuilders.standaloneSetup(new ErrorBoundary())
            .setControllerAdvice(new ApiErrorHandler()).build();
    }

    @Test
    void specifiedFailureRetainsCodeMessageAndSingleField() throws Exception {
        mvc.perform(get("/errors/domain"))
            .andExpect(status().isConflict())
            .andExpect(content().json("""
                {"success":false,"meta":{},"code":"DUPLICATE_EMAIL",
                 "message":"이미 가입된 이메일입니다","field":"email"}
                """, true));
    }

    @Test
    void unexpectedExceptionDoesNotLeakSensitiveDetails() throws Exception {
        var result = mvc.perform(get("/errors/internal"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("500"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password_hash", "SQLException");
    }

    @Test
    void malformedJsonProducesFlat400() throws Exception {
        mvc.perform(post("/errors/input").contentType(MediaType.APPLICATION_JSON).content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("400"))
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.meta").isMap());
    }

    @Test
    void beanValidationUsesSingleField() throws Exception {
        mvc.perform(post("/errors/input").contentType(MediaType.APPLICATION_JSON).content("""
            {"name":""}
            """))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("name"))
            .andExpect(jsonPath("$.fields").doesNotExist());
    }

    @RestController
    static class ErrorBoundary {
        @GetMapping("/errors/domain")
        public void domain() {
            throw new ApiException(409, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다", "email");
        }

        @GetMapping("/errors/internal")
        public void internal() {
            throw new IllegalStateException("SQLException password_hash");
        }

        @PostMapping("/errors/input")
        public ApiResponse<Void> input(@Valid @RequestBody Input input) {
            return ApiResponse.ok();
        }
    }

    static class Input {
        @NotBlank
        public String name;
    }
}
