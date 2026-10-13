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

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiErrorContractTest {
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new ErrorController())
                .setControllerAdvice(new ApiExceptionHandler()).build();
    }

    @ParameterizedTest
    @CsvSource({"400,INVALID_STRUCTURE", "400,UNSUPPORTED_FILE_TYPE", "409,DUPLICATE_EMAIL",
            "413,FILE_TOO_LARGE", "413,CONTENT_TOO_LARGE", "404,404"})
    void safeDomainStatusCodeAndField(int status, String code) throws Exception {
        mvc.perform(get("/errors/{status}/{code}", status, code))
                .andExpect(status().is(status))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value("안전한 오류"))
                .andExpect(jsonPath("$.field").value("content"));
    }

    @Test
    void unexpectedFailureDoesNotLeakSqlOrSecrets() throws Exception {
        mvc.perform(get("/errors/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("500"))
                .andExpect(jsonPath("$.message").value("요청을 처리하지 못했습니다."))
                .andExpect(jsonPath("$.field").value(nullValue()));
    }

    @RestController
    static class ErrorController {
        @GetMapping("/errors/{status}/{code}")
        void rejection(@PathVariable int status, @PathVariable String code) {
            throw new DomainException(HttpStatus.valueOf(status), code, "안전한 오류", "content");
        }

        @GetMapping("/errors/unexpected")
        void unexpected() {
            throw new IllegalStateException("SQL password and private data");
        }
    }
}
