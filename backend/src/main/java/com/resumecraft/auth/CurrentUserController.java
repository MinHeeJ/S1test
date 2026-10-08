package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes the persisted current nickname; the shared security filter supplies CSRF headers. */
@RestController
public class CurrentUserController {
    private final CurrentUserService service;

    public CurrentUserController(CurrentUserService service) {
        this.service = service;
    }

    @GetMapping("/api/auth/me")
    public ApiResponse.Data<CurrentUser> getCurrentUser(@AuthenticationPrincipal SessionUser user) {
        return ApiResponse.data(service.getCurrentUser(user));
    }

    public record CurrentUser(String nickname) {
    }
}
