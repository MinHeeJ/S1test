package com.resumecraft.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.filter.OncePerRequestFilter;

/** Session-only API admission with CSRF enabled and anonymous 401 precedence. */
@Configuration
public class SecurityConfig {
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public HttpSessionSecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper json) throws Exception {
        var csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
        http.securityContext(context -> context.securityContextRepository(securityContextRepository()))
                .csrf(config -> config.csrfTokenRepository(csrf)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> reject(response, json, 401))
                        .accessDeniedHandler((request, response, error) -> reject(response, json, 403)))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable());
        // Context is loaded before this filter; protected anonymous writes must not become CSRF 403s.
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(
                    HttpServletRequest request,
                    HttpServletResponse response,
                    FilterChain chain
            ) throws ServletException, IOException {
                String path = request.getServletPath();
                if (path.isEmpty()) {
                    path = request.getRequestURI();
                }
                boolean publicRequest = ("GET".equals(request.getMethod()) && "/api/health".equals(path))
                        || ("POST".equals(request.getMethod())
                        && ("/api/auth/login".equals(path) || "/api/auth/signup".equals(path)));
                Authentication actor = SecurityContextHolder.getContext().getAuthentication();
                boolean authenticated = actor != null && actor.isAuthenticated()
                        && !(actor instanceof AnonymousAuthenticationToken);
                if (path.startsWith("/api/") && !publicRequest && !authenticated) {
                    reject(response, json, 401);
                    return;
                }
                chain.doFilter(request, response);
            }
        }, CsrfFilter.class);
        return http.build();
    }

    private static void reject(HttpServletResponse response, ObjectMapper json, int status) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        json.writeValue(response.getOutputStream(), ApiError.of(
                String.valueOf(status), status == 401 ? "로그인이 필요합니다." : "요청 권한을 확인해 주세요.", null));
    }
}
