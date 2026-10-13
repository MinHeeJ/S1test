package com.resumecraft.health;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.DatabaseHealthMapper;
import com.resumecraft.common.DomainException;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public database readiness and same-origin CSRF bootstrap, not a product screen. */
@RestController
public class HealthController {
    private final DatabaseHealthMapper mapper;

    public HealthController(DatabaseHealthMapper mapper) {
        this.mapper = mapper;
    }

    /** Forces the deferred CSRF cookie and returns 503 when the database cannot be read. */
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth(CsrfToken token) {
        if (token != null) {
            token.getToken();
        }
        try {
            if (mapper.ping() != 1) {
                throw new IllegalStateException("Unexpected database probe result");
            }
        } catch (Exception error) {
            throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE, "503", "서비스를 준비 중입니다.", null);
        }
        return ApiResponse.ok(null);
    }
}
