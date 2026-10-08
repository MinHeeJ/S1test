package com.resumecraft.resumes;

import com.resumecraft.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 없이 호출 가능한 생존 probe이며 업무 데이터를 발명하지 않는다. */
@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ApiResponse<Void> getHealth() {
        return ApiResponse.ok();
    }
}
