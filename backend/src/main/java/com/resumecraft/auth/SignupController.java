package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Completes signup persistence/verification before establishing session authentication. */
@RestController
public class SignupController {
    private final SignupService service;
    private final AuthSessionService sessions;

    public SignupController(SignupService service, AuthSessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse signup(@RequestBody SignupInput input,
            HttpServletRequest request, HttpServletResponse response) {
        var user = service.signup(input);
        sessions.authenticate(user, request, response);
        return ApiResponse.ok();
    }
}
