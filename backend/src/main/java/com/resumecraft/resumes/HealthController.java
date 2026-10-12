package com.resumecraft.resumes;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Readiness probes real SQL and the required Flyway version, without fabricating business data. */
@RestController
public class HealthController {
    private final ResumeMapper mapper;

    public HealthController(ResumeMapper mapper) {
        this.mapper = mapper;
    }

    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth() {
        try {
            if (mapper.ready() == 1) return ApiResponse.of(null);
        } catch (RuntimeException error) {
            // Database details must not be exposed by a public probe.
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE", "서비스 준비 중입니다.", null);
    }
}
