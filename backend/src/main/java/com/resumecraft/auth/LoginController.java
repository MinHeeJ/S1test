package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Completes login persistence/verification before establishing session authentication. */
@RestController
public class LoginController {
    private final LoginService service;
    private final AuthSessionService sessions;

    public LoginController(LoginService service, AuthSessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/login")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse login(@RequestBody LoginInput input,
            HttpServletRequest request, HttpServletResponse response) {
        var user = service.login(input);
        sessions.authenticate(user, request, response);
        return ApiResponse.ok();
    }
}
