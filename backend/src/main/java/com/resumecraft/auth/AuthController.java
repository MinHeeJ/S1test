package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.CurrentUserId;
import com.resumecraft.security.SessionAuthentication;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Auth transport: commits account commands before rotating and saving the real security session. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final SessionAuthentication sessions;

    public AuthController(AuthService auth, SessionAuthentication sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }

    /** Public but CSRF-protected signup starts a session only after the account transaction succeeds. */
    @PostMapping("/signup")
    public ResponseEntity<Void> signup(
            @Valid @RequestBody SignupRequest input,
            HttpServletRequest request,
            HttpServletResponse response) {
        sessions.establish(request, response, auth.signup(input));
        return ResponseEntity.noContent().build();
    }

    /** Existing accounts authenticate without creating or modifying domain rows. */
    @PostMapping("/login")
    public ResponseEntity<Void> login(
            @Valid @RequestBody LoginRequest input,
            HttpServletRequest request,
            HttpServletResponse response) {
        sessions.establish(request, response, auth.login(input));
        return ResponseEntity.noContent().build();
    }

    /** Invalidates only the current authenticated session; no request body or domain deletion is required. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        CurrentUserId.require();
        sessions.clear(request, response);
        return ResponseEntity.noContent().build();
    }

    /** Returns only the persisted nickname of the UUID principal established by session authentication. */
    @GetMapping("/me")
    public ApiResponse<CurrentUser> getCurrentUser() {
        return ApiResponse.of(auth.current(CurrentUserId.require()));
    }
}
