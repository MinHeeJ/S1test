package com.resumecraft.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects anonymous protected API requests before CSRF so write requests also receive 401, not 403. */
public class ApiAuthenticationFilter extends OncePerRequestFilter {
    private final ObjectMapper json;

    public ApiAuthenticationFilter(ObjectMapper json) {
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        boolean publicApi = ("GET".equals(request.getMethod()) && "/api/health".equals(path))
            || ("POST".equals(request.getMethod())
                && ("/api/auth/signup".equals(path) || "/api/auth/login".equals(path)));
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (path.startsWith("/api/") && !publicApi
                && (authentication == null || !authentication.isAuthenticated()
                    || authentication instanceof AnonymousAuthenticationToken)) {
            response.setStatus(401);
            response.setContentType("application/json");
            json.writeValue(response.getOutputStream(),
                ApiError.of("UNAUTHORIZED", "로그인이 필요합니다.", null));
            return;
        }
        chain.doFilter(request, response);
    }
}
