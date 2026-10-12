package com.resumecraft.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.stereotype.Component;

/** Auth commands call this only after their transaction commits; principals are immutable owner UUIDs. */
@Component
public class SessionAuthentication {
    private final SecurityContextRepository contexts;
    private final CookieCsrfTokenRepository csrf;

    public SessionAuthentication(SecurityContextRepository contexts, CookieCsrfTokenRepository csrf) {
        this.contexts = contexts;
        this.csrf = csrf;
    }

    public void establish(HttpServletRequest request, HttpServletResponse response, UUID userId) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(userId.toString(), null, List.of());
        request.getSession(true);
        new ChangeSessionIdAuthenticationStrategy().onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        csrf.saveToken(null, request, response);
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        contexts.saveContext(SecurityContextHolder.createEmptyContext(), request, response);
        csrf.saveToken(null, request, response);
    }
}
