package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;

@WebMvcTest(ApiBoundaryTest.BoundaryController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, ApiBoundaryTest.BoundaryController.class})
class ApiBoundaryTest {
    @Autowired MockMvc mvc;

    // No existing Java test existed; this is the common MVC setup for subsequent slices.
    @RestController
    static class BoundaryController {
        @GetMapping("/api/auth/me")
        public ApiResponse<String> me() { return ApiResponse.of("boundary"); }

        @PostMapping("/api/resumes")
        public ApiResponse<String> write() { return ApiResponse.of("boundary"); }

        @GetMapping("/api/boundary/error/{code}")
        public void error(@PathVariable String code) {
            HttpStatus status = switch (code) {
                case "DUPLICATE_EMAIL" -> HttpStatus.CONFLICT;
                case "CONTENT_TOO_LARGE", "FILE_TOO_LARGE" -> HttpStatus.PAYLOAD_TOO_LARGE;
                case "NOT_FOUND" -> HttpStatus.NOT_FOUND;
                default -> HttpStatus.BAD_REQUEST;
            };
            throw new ApiException(status, code, "공개 오류", null);
        }

        @GetMapping("/api/boundary/internal")
        public void internal() { throw new IllegalStateException("password_hash secret SQL"); }
    }

    @Test
    void anonymousMePublishesCsrfAndJson401() throws Exception {
        mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(header().exists("X-CSRF-TOKEN"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
            .andExpect(jsonPath("$.field").isEmpty());
    }

    @Test
    void protectedWriteWithoutSessionIs401() throws Exception {
        mvc.perform(post("/api/resumes").with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedWriteWithoutCsrfIs403() throws Exception {
        mvc.perform(post("/api/resumes").with(user("owner")))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void sessionWriteWithCsrfReachesHandler() throws Exception {
        mvc.perform(post("/api/resumes").with(user("owner")).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data").value("boundary"));
    }

    @Test
    void initialTokenCanAuthorizeTheSameAnonymousSession() throws Exception {
        var response = mvc.perform(get("/api/auth/me")).andReturn();
        var session = (org.springframework.mock.web.MockHttpSession) response.getRequest().getSession(false);
        mvc.perform(post("/api/resumes").session(session)
                .header("X-CSRF-TOKEN", response.getResponse().getHeader("X-CSRF-TOKEN")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void publicErrorEnvelopePreservesStatuses() throws Exception {
        for (String code : new String[]{"INVALID_STRUCTURE", "UNSUPPORTED_FILE_TYPE", "DUPLICATE_EMAIL",
            "FILE_TOO_LARGE", "CONTENT_TOO_LARGE", "NOT_FOUND"}) {
            int expected = switch (code) {
                case "DUPLICATE_EMAIL" -> 409;
                case "FILE_TOO_LARGE", "CONTENT_TOO_LARGE" -> 413;
                case "NOT_FOUND" -> 404;
                default -> 400;
            };
            mvc.perform(get("/api/boundary/error/{code}", code).with(user("owner")))
                .andExpect(status().is(expected))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value("공개 오류"))
                .andExpect(jsonPath("$.field").isEmpty());
        }
    }

    @Test
    void unexpectedFailureNeverLeaksSensitiveDetails() throws Exception {
        var result = mvc.perform(get("/api/boundary/internal").with(user("owner")))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password_hash", "secret", "SQL");
    }

    @Test
    void approvedFixtureIsLoadedFromClasspath() throws Exception {
        var options = new org.yaml.snakeyaml.LoaderOptions();
        options.setMaxAliasesForCollections(1000);
        var yaml = new org.yaml.snakeyaml.Yaml(options);
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            java.util.Map<?, ?> contract = yaml.load(input);
            java.util.Map<?, ?> schemas = (java.util.Map<?, ?>)
                ((java.util.Map<?, ?>) contract.get("components")).get("schemas");
            java.util.Map<?, ?> error = (java.util.Map<?, ?>) schemas.get("ApiError");
            assertThat(error.get("required"))
                .isEqualTo(java.util.List.of("success", "meta", "code", "message", "field"));
        }
    }
}
