package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Session admission and CSRF validation precede this session-only command. */
@RestController
public class LogoutController {
    private final LogoutService service;

    public LogoutController(LogoutService service) {
        this.service = service;
    }

    @PostMapping("/api/auth/logout")
    public ApiResponse logout(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) {
        service.logout(request, response, authentication);
        return ApiResponse.ok();
    }
}
