package com.example.auth;

import com.example.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Session authentication transport. Only UUID identity, no password or invented role, is retained. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    private final SessionAuthenticationStrategy sessionStrategy;
    private final SecurityContextRepository contextRepository;
    private final CookieCsrfTokenRepository csrfRepository;

    public AuthController(
        AuthService service,
        SessionAuthenticationStrategy sessionStrategy,
        SecurityContextRepository contextRepository,
        CookieCsrfTokenRepository csrfRepository
    ) {
        this.service = service;
        this.sessionStrategy = sessionStrategy;
        this.contextRepository = contextRepository;
        this.csrfRepository = csrfRepository;
    }

    /** Commits a new account, then performs session fixation protection and explicit context save. */
    @PostMapping("/signup")
    public ApiResponse<Void> signup(
        @RequestBody SignupInput input, HttpServletRequest request, HttpServletResponse response
    ) {
        authenticate(service.signup(input), request, response);
        return ApiResponse.ok();
    }

    /** Establishes the same identity used by owner-scoped resume and photo operations. */
    @PostMapping("/login")
    public ApiResponse<Void> login(
        @RequestBody LoginInput input, HttpServletRequest request, HttpServletResponse response
    ) {
        authenticate(service.login(input), request, response);
        return ApiResponse.ok();
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUser> getCurrentUser(Authentication authentication) {
        return ApiResponse.ok(service.getCurrentUser(UUID.fromString(authentication.getName())));
    }

    /** Invalidates the authenticated session and its CSRF cookie, without mutating business rows. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(
        Authentication authentication, HttpServletRequest request, HttpServletResponse response
    ) {
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        csrfRepository.saveToken(null, request, response);
        return ApiResponse.ok();
    }

    private void authenticate(AuthUser user, HttpServletRequest request, HttpServletResponse response) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user.getId(), null, List.of());
        sessionStrategy.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        csrfRepository.saveToken(csrfRepository.generateToken(request), request, response);
    }
}
