package com.resumecraft.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public liveness endpoint; database startup readiness is enforced by Flyway. */
@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth() {
        return ApiResponse.ok();
    }
}
