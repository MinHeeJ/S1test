package com.resumecraft.health;

import com.resumecraft.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes only readiness, without creating a synthetic business payload. */
@RestController
public class HealthController {
    private final HealthService health;

    public HealthController(HealthService health) {
        this.health = health;
    }

    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth() {
        health.requireReady();
        return ApiResponse.ok();
    }
}
