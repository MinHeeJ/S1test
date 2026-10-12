package com.resumecraft.common;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(ErrorEnvelopeTest.ErrorProbeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ErrorEnvelopeTest.ErrorProbeController.class})
class ErrorEnvelopeTest {
    @Autowired
    private MockMvc mvc;

    @Test
    void businessErrorIsFlatAndPreservesTheSingleField() throws Exception {
        mvc.perform(get("/api/test/business-error").with(user("session-actor")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다."))
                .andExpect(jsonPath("$.field").value("email"))
                .andExpect(jsonPath("$.error").doesNotExist())
                .andExpect(jsonPath("$.fields").doesNotExist());
    }

    @Test
    void unexpectedErrorDoesNotLeakExceptionOrSql() throws Exception {
        mvc.perform(get("/api/test/unexpected-error").with(user("session-actor")))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("500"))
                .andExpect(jsonPath("$.message").value("요청을 처리하지 못했습니다."))
                .andExpect(jsonPath("$.field").isEmpty())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    void malformedTypedInputReturnsSafe400() throws Exception {
        mvc.perform(get("/api/test/number").param("value", "not-a-number").with(user("session-actor")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("400"))
                .andExpect(jsonPath("$.message").value("입력값을 확인해 주세요."));
    }

    @RestController
    static class ErrorProbeController {
        @GetMapping("/api/test/business-error")
        void business() {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.", "email");
        }

        @GetMapping("/api/test/unexpected-error")
        void unexpected() {
            throw new IllegalStateException("SELECT password_hash FROM users; private database diagnostics");
        }

        @GetMapping("/api/test/number")
        int number(@RequestParam int value) {
            return value;
        }
    }
}
