package com.resumecraft.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Public signup endpoint; session creation follows the transactional service return. */
@RestController
public class SignupController {
    private final SignupService service;
    private final AuthSessionService sessions;

    public SignupController(SignupService service, AuthSessionService sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/signup")
    public ResponseEntity<Void> signup(@Valid @RequestBody SignupRequest body,
        HttpServletRequest request, HttpServletResponse response) {
        sessions.start(service.signup(body), request, response);
        return ResponseEntity.noContent().build();
    }
}
