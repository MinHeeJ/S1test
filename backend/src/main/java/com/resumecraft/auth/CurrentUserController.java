package com.resumecraft.auth;

import com.resumecraft.common.ApiException;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.persistence.UserMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Reads the session account without exposing identity, email or password hashes. */
@RestController
public class CurrentUserController {
    private final UserMapper users;

    public CurrentUserController(UserMapper users) {
        this.users = users;
    }

    @GetMapping("/api/auth/me")
    public ApiResponse<CurrentUser> getCurrentUser(Authentication actor) {
        var account = users.findById(Long.valueOf(actor.getName()));
        if (account == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        return ApiResponse.ok(new CurrentUser(account.nickname()));
    }
}
