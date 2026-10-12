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

/** Establishes a fixation-protected session after login succeeds. */
@RestController
public class LoginController {
    private final LoginService service;
    private final SessionContext sessions;

    public LoginController(LoginService service, SessionContext sessions) {
        this.service = service;
        this.sessions = sessions;
    }

    @PostMapping("/api/auth/login")
    public ApiResponse<Void> login(@RequestBody LoginInput input,
            HttpServletRequest request, HttpServletResponse response) {
        Long id = service.login(input);
        sessions.establish(UsernamePasswordAuthenticationToken.authenticated(id.toString(), null, List.of()),
                request, response);
        return ApiResponse.ok();
    }
}
