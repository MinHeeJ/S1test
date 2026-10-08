package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionAuthentication;
import com.resumecraft.common.SessionUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** JSON session authentication endpoints; admission and CSRF remain in the shared security chain. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final SignupService signup;
    private final LoginService login;
    private final LogoutService logout;
    private final SessionAuthentication sessions;

    public AuthController(SignupService signup, LoginService login, LogoutService logout,
            SessionAuthentication sessions) {
        this.signup = signup;
        this.login = login;
        this.logout = logout;
        this.sessions = sessions;
    }

    /** A 201 is emitted only after account commit and successful session persistence. */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> signup(@RequestBody SignupInput input,
            HttpServletRequest request, HttpServletResponse response) {
        sessions.authenticate(signup.signup(input), request, response);
        return ApiResponse.ok();
    }

    /** Authentication rotates the session id; login does not write users. */
    @PostMapping("/login")
    public ApiResponse<Void> login(@RequestBody LoginInput input,
            HttpServletRequest request, HttpServletResponse response) {
        sessions.authenticate(login.login(input), request, response);
        return ApiResponse.ok();
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) {
        logout.logout(request, response, authentication);
        return ApiResponse.ok();
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUser> getCurrentUser(@AuthenticationPrincipal SessionUser user) {
        return ApiResponse.of(new CurrentUser(user.nickname()));
    }
}
