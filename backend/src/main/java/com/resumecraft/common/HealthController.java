package com.resumecraft.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public liveness probe; does not expose database or account information. */
@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ApiResponse getHealth() {
        return ApiResponse.ok();
    }
}
