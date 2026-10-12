package com.resumecraft.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Public credential endpoint with bodyless success and a persisted security context. */
@RestController
public class LoginController {
    private final LoginService service;
    private final AuthSessionService sessions;

    public LoginController(LoginService service, AuthSessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body,
        HttpServletRequest request, HttpServletResponse response) {
        sessions.start(service.login(body), request, response);
        return ResponseEntity.noContent().build();
    }
}
