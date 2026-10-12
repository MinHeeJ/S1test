package com.resumecraft.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfLogoutHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Component;

/** Explicit context persistence for JSON authentication, independent of account DTOs and repositories. */
@Component
public class SessionContext {
    private final SecurityContextRepository contexts;
    private final CsrfTokenRepository tokens;

    public SessionContext(SecurityContextRepository contexts, CsrfTokenRepository tokens) {
        this.contexts = contexts;
        this.tokens = tokens;
    }

    /** Call only after credentials are verified and any signup transaction has committed. */
    public void establish(Authentication actor, HttpServletRequest request, HttpServletResponse response) {
        request.getSession(true);
        new ChangeSessionIdAuthenticationStrategy().onAuthentication(actor, request, response);
        new CsrfAuthenticationStrategy(tokens).onAuthentication(actor, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(actor);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
    }

    /** Invalidates only this session and clears its CSRF cookie; no business data is deleted. */
    public void clear(HttpServletRequest request, HttpServletResponse response) {
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        new CsrfLogoutHandler(tokens).logout(request, response, actor);
        new SecurityContextLogoutHandler().logout(request, response, actor);
    }
}
