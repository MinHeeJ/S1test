package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Authenticated, CSRF-protected session termination endpoint. */
@RestController
public class LogoutController {
    private final LogoutService service;

    public LogoutController(LogoutService service) {
        this.service = service;
    }

    @PostMapping("/api/auth/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        service.logout(request, response);
        return ApiResponse.ok();
    }
}
