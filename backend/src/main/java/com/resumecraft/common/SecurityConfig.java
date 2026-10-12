package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/** Session-only admission; ownership and deleted-row predicates belong to feature services. */
@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
        http.csrf(csrf -> csrf.csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/signup", "/api/auth/login", "/api/health").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) ->
                    writeError(response, mapper, 401, "UNAUTHENTICATED", "로그인이 필요합니다."))
                .accessDeniedHandler((request, response, error) ->
                    writeError(response, mapper, isAuthenticated() ? 403 : 401,
                        "ACCESS_DENIED", "요청 권한을 확인해주세요.")))
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable())
            .sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()))
            .addFilterAfter(new CsrfHeaderFilter(), CsrfFilter.class);
        return http.build();
    }

    private static boolean isAuthenticated() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder
            .getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
            && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
    }

    private static void writeError(HttpServletResponse response, ObjectMapper mapper,
        int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        mapper.writeValue(response.getOutputStream(), ApiError.of(code, message, null));
    }

    /** Publishes the session token even when the subsequent me request is rejected with 401. */
    private static class CsrfHeaderFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
            if ("/api/auth/me".equals(request.getRequestURI())) {
                CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
                response.setHeader("X-CSRF-TOKEN", token.getToken());
            }
            chain.doFilter(request, response);
        }
    }
}
