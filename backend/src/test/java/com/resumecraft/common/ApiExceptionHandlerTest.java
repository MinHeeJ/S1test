package com.resumecraft.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Tests translation only; feature-owned validators/ownership checks are tested by their owners. */
class ApiExceptionHandlerTest {
    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new ErrorProbe())
            .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    @RestController
    static class ErrorProbe {
        @GetMapping("/error-probe/{status}/{code}")
        void domain(@PathVariable int status, @PathVariable String code) {
            throw new DomainException(HttpStatus.valueOf(status), code, "입력값을 확인해 주세요.", "content");
        }

        @GetMapping("/error-probe/unexpected")
        void unexpected() {
            throw new IllegalStateException("private SQL and credential details");
        }
    }

    @ParameterizedTest
    @CsvSource({
        "400,INVALID_STRUCTURE", "400,UNSUPPORTED_FILE_TYPE", "409,DUPLICATE_EMAIL",
        "413,FILE_TOO_LARGE", "413,CONTENT_TOO_LARGE", "404,NOT_FOUND"
    })
    void preservesIntentionalCodeStatusAndField(int status, String code) throws Exception {
        mvc.perform(get("/error-probe/{status}/{code}", status, code))
            .andExpect(status().is(status))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.message").value("입력값을 확인해 주세요."))
            .andExpect(jsonPath("$.field").value("content"))
            .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    void unexpectedErrorHasExplicitNullFieldAndNoSensitiveDetail() throws Exception {
        mvc.perform(get("/error-probe/unexpected"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(content().string(org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.containsString("private SQL"))));
    }
}
