package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class})
class ErrorEnvelopeTest {
    @Autowired
    MockMvc mvc;
    @MockBean
    HealthController controller;

    @Test
    void internalErrorNeverLeaksSqlOrCredentials() throws Exception {
        when(controller.getHealth()).thenThrow(new IllegalStateException("password=secret SQL SELECT users"));
        mvc.perform(get("/api/health"))
            .andExpect(status().isInternalServerError())
            .andExpect(content().json("""
                {"success":false,"meta":{},"code":"Internal Server Error",
                 "message":"Internal Server Error","field":null}
                """, true));
    }

    @Test
    void businessErrorRetainsCodeMessageAndField() throws Exception {
        when(controller.getHealth()).thenThrow(new ApiException(
            HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "구조가 올바르지 않습니다.", "content"));
        mvc.perform(get("/api/health"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
            .andExpect(jsonPath("$.message").value("구조가 올바르지 않습니다."))
            .andExpect(jsonPath("$.field").value("content"));
    }
}
