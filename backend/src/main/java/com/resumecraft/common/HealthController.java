package com.resumecraft.common;

import java.util.Map;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public liveness endpoint and same-origin session CSRF bootstrap. */
@RestController
public class HealthController {
    /** Accessing the deferred token materializes its cookie before the response is committed. */
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth(CsrfToken csrfToken) {
        return new ApiResponse<>(true, Map.of(
                "csrfToken", csrfToken.getToken(),
                "csrfHeaderName", csrfToken.getHeaderName()), null);
    }
}
