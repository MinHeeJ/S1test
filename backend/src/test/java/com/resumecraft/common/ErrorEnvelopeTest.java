package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ErrorEnvelopeTest.ErrorController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ErrorEnvelopeTest.ErrorController.class})
class ErrorEnvelopeTest {
    @Autowired MockMvc mvc;

    @RestController
    static class ErrorController {
        @GetMapping("/contract-error")
        void failure() {
            throw new IllegalStateException("private SQL password details");
        }

        @GetMapping("/contract-business")
        void business() {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.", "email");
        }
    }

    @Test
    void unexpectedErrorsDoNotLeakInternals() throws Exception {
        mvc.perform(get("/contract-error"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().json("""
                        {"success":false,"meta":{},"code":"INTERNAL_ERROR",
                         "message":"요청을 처리하지 못했습니다.","field":null}
                        """, true));
    }

    @Test
    void businessErrorIsFlatWithSingleField() throws Exception {
        mvc.perform(get("/contract-business"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.field").value("email"))
                .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
