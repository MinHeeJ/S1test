package com.resumecraft.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Authenticated, bodyless logout ends the session, never account or document data. */
@RestController
public class LogoutController {
    private final AuthSessionService sessions;

    public LogoutController(AuthSessionService sessions) {
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        sessions.logout(request, response);
        return ResponseEntity.noContent().build();
    }
}
