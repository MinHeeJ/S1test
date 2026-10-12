package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

/** Returns only the current persisted nickname for an authenticated UUID principal. */
@RestController
public class CurrentUserController {
    private final LoginService service;

    public CurrentUserController(LoginService service) {
        this.service = service;
    }

    @GetMapping("/api/auth/me")
    public ApiResponse<CurrentUser> getCurrentUser(Principal principal) {
        return ApiResponse.of(service.currentUser(principal.getName()));
    }
}
