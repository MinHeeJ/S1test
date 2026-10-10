package com.example.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import java.io.IOException;
import java.util.List;

/** Session-only admission: no product roles; CSRF is retained even for public authentication mutations. */
@Configuration
public class SecurityConfig {
    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository() {
        return CookieCsrfTokenRepository.withHttpOnlyFalse();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** JSON login/signup must invoke this strategy then save their context through the repository. */
    @Bean
    public SessionAuthenticationStrategy sessionAuthenticationStrategy(CookieCsrfTokenRepository repository) {
        return new CompositeSessionAuthenticationStrategy(List.of(
            new ChangeSessionIdAuthenticationStrategy(), new CsrfAuthenticationStrategy(repository)
        ));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        ObjectMapper mapper,
        CookieCsrfTokenRepository csrfRepository,
        SecurityContextRepository contextRepository
    ) throws Exception {
        // Plain cookie/header tokens are used by the SPA; no form-rendered XOR token is transmitted.
        var handler = new CsrfTokenRequestAttributeHandler();
        http.csrf(csrf -> csrf.csrfTokenRepository(csrfRepository).csrfTokenRequestHandler(handler));
        http.securityContext(context -> context.securityContextRepository(contextRepository));
        http.authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login").permitAll()
            .requestMatchers("/api/**").authenticated()
            .anyRequest().permitAll());
        http.exceptionHandling(errors -> errors
            .authenticationEntryPoint((request, response, exception) ->
                writeError(response, mapper, 401, "로그인이 필요합니다."))
            .accessDeniedHandler((request, response, exception) -> {
                var authentication = org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication();
                boolean anonymous = authentication == null
                    || authentication instanceof
                        org.springframework.security.authentication.AnonymousAuthenticationToken;
                boolean publicAuth = request.getRequestURI().equals("/api/auth/login")
                    || request.getRequestURI().equals("/api/auth/signup");
                int status = anonymous && !publicAuth ? 401 : 403;
                writeError(response, mapper, status, status == 401
                    ? "로그인이 필요합니다." : "요청 권한 또는 보안 토큰을 확인해 주세요.");
            }));
        // Resource-owned JSON auth controllers establish sessions and handle /api/auth/logout.
        http.formLogin(form -> form.disable());
        http.httpBasic(basic -> basic.disable());
        http.logout(logout -> logout.disable());
        http.requestCache(cache -> cache.disable());
        return http.build();
    }

    private static void writeError(
        HttpServletResponse response, ObjectMapper mapper, int status, String message
    ) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getWriter(), new ApiError(Integer.toString(status), message, null));
    }
}
