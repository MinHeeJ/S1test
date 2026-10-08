package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

/** Session-only admission with cookie/header CSRF for every mutation, including public authentication. */
@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper json,
            SecurityContextRepository repository) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health", "/api/auth/signup", "/api/auth/login").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll());
        http.csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()));
        http.securityContext(context -> context.securityContextRepository(repository));
        http.sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()));
        http.requestCache(cache -> cache.disable());
        http.formLogin(form -> form.disable());
        http.httpBasic(basic -> basic.disable());
        http.logout(logout -> logout.disable());
        http.exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> writeError(
                        json, response, 401, "UNAUTHORIZED", "로그인이 필요합니다."))
                .accessDeniedHandler((request, response, error) -> {
                    var authentication = org.springframework.security.core.context.SecurityContextHolder
                            .getContext().getAuthentication();
                    boolean anonymous = authentication == null || !authentication.isAuthenticated()
                            || authentication instanceof
                            org.springframework.security.authentication.AnonymousAuthenticationToken;
                    boolean publicAuth = request.getRequestURI().equals("/api/auth/login")
                            || request.getRequestURI().equals("/api/auth/signup");
                    int status = anonymous && !publicAuth ? 401 : 403;
                    writeError(json, response, status, status == 401 ? "UNAUTHORIZED" : "FORBIDDEN",
                            status == 401 ? "로그인이 필요합니다." : "요청을 허용할 수 없습니다.");
                }));
        http.addFilterAfter(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                    FilterChain chain) throws ServletException, IOException {
                CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
                if (token != null) {
                    token.getToken();
                }
                chain.doFilter(request, response);
            }
        }, AnonymousAuthenticationFilter.class);
        return http.build();
    }

    private static void writeError(ObjectMapper json, HttpServletResponse response,
            int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getWriter(), ApiError.of(code, message, null));
    }
}
