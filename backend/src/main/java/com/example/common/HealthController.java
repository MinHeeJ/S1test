package com.example.common;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public liveness endpoint also materializes the deferred CSRF cookie for same-origin clients. */
@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth(CsrfToken csrfToken) {
        csrfToken.getToken();
        return ApiResponse.ok();
    }
}
