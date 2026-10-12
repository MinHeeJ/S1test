package com.resumecraft.resumes;

import com.resumecraft.common.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(HealthController.class)
@ContextConfiguration(classes = ResumeCraftApplication.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
class HealthControllerTest {
    @Autowired MockMvc mvc;
    @MockBean ResumeMapper mapper;

    @Test
    void getHealthProbesDatabaseAndHasNoBusinessData() throws Exception {
        when(mapper.ready()).thenReturn(1);
        mvc.perform(get("/api/health")).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper).ready();
    }

    @Test
    void getHealthDatabaseFailureReturnsSafe503() throws Exception {
        when(mapper.ready()).thenThrow(new IllegalStateException("password SQL"));
        mvc.perform(get("/api/health")).andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.field").isEmpty())
            .andExpect(jsonPath("$.message").value("서비스 준비 중입니다."));
    }

    @Test
    void getHealthRequiresAppliedMigrations() throws Exception {
        when(mapper.ready()).thenReturn(0);
        mvc.perform(get("/api/health")).andExpect(status().isServiceUnavailable());
    }
}
