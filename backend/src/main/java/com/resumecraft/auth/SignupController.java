package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Establishes a fixation-protected session after signup succeeds. */
@RestController
public class SignupController {
    private final SignupService service;
    private final SessionContext sessions;

    public SignupController(SignupService service, SessionContext sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/signup")
    public ApiResponse<Void> signup(@RequestBody SignupInput input,
            HttpServletRequest request, HttpServletResponse response) {
        Long id = service.signup(input);
        sessions.establish(UsernamePasswordAuthenticationToken.authenticated(id.toString(), null, List.of()),
                request, response);
        return ApiResponse.ok();
    }
}
