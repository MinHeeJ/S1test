package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

/** DB 없는 공통 경계 시험. Probe는 test context에만 존재하고 업무 endpoint를 대체하지 않는다. */
@SpringJUnitConfig(CommonMvcSupport.WebConfig.class)
@WebAppConfiguration
abstract class CommonMvcSupport {
    @Autowired
    WebApplicationContext context;
    MockMvc mvc;

    @BeforeEach
    void setUpMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ApiErrorHandler.class, BoundaryProbe.class})
    static class WebConfig {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper().findAndRegisterModules();
        }
    }

    @RestController
    static class BoundaryProbe {
        @GetMapping("/api/common-contract")
        public ApiResponse<Void> get(@RequestParam(defaultValue = "ok") String outcome) {
            if ("missing".equals(outcome)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "찾을 수 없습니다.", null);
            }
            if ("conflict".equals(outcome)) {
                throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_EMAIL", "이미 가입된 이메일입니다.", "email");
            }
            if ("unexpected".equals(outcome)) {
                throw new IllegalStateException("password_hash=secret; SELECT * FROM users; jdbc:postgresql");
            }
            return ApiResponse.ok();
        }

        @PostMapping("/api/common-contract")
        public ApiResponse<Input> post(@Valid @RequestBody Input input) {
            return ApiResponse.ok(input);
        }
    }

    record Input(@NotBlank String title) {
    }
}
