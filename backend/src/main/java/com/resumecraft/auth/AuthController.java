package com.resumecraft.auth;

import com.resumecraft.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.logout.CookieClearingLogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/** Session HTTP commands; principal name is the decimal users.id used by other resource adapters. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService service;
    private final HttpSessionSecurityContextRepository contexts;
    private final CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();

    public AuthController(AuthService service, HttpSessionSecurityContextRepository contexts) {
        this.service = service;
        this.contexts = contexts;
        csrf.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
    }

    /** Successful service return means the account transaction committed before authentication. */
    @PostMapping("/signup")
    public ResponseEntity<Void> signup(
            @RequestBody SignupRequest input,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        establishSession(service.signup(input), request, response);
        return ResponseEntity.noContent().build();
    }

    /** Credentials are checked against persisted BCrypt hashes, then discarded. */
    @PostMapping("/login")
    public ResponseEntity<Void> login(
            @RequestBody LoginRequest input,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        establishSession(service.login(input), request, response);
        return ResponseEntity.noContent().build();
    }

    /** Terminates only this session, clearing its context and browser cookies without DB writes. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            Authentication actor,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        new SecurityContextLogoutHandler().logout(request, response, actor);
        new CookieClearingLogoutHandler("JSESSIONID").logout(request, response, actor);
        csrf.saveToken(null, request, response);
        return ResponseEntity.noContent().build();
    }

    /** Nickname-only projection; email, id and password hash are not part of the wire response. */
    @GetMapping("/me")
    public ApiResponse<CurrentUser> getCurrentUser(Authentication actor) {
        return ApiResponse.ok(service.currentUser(Long.valueOf(actor.getName())));
    }

    private void establishSession(Long id, HttpServletRequest request, HttpServletResponse response) {
        var actor = UsernamePasswordAuthenticationToken.authenticated(id.toString(), null, List.of());
        new ChangeSessionIdAuthenticationStrategy().onAuthentication(actor, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(actor);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        // Authentication rotates the CSRF token; the client refreshes it via the public health GET.
        csrf.saveToken(null, request, response);
    }
}
