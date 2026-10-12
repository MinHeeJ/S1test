package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;

/** Session-only admission: ownership remains a feature service and SQL responsibility. */
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
    public CsrfTokenRepository csrfTokenRepository() {
        var tokens = CookieCsrfTokenRepository.withHttpOnlyFalse();
        tokens.setCookieCustomizer(cookie -> cookie.sameSite("Lax"));
        return tokens;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper,
            SecurityContextRepository repository, CsrfTokenRepository tokens) throws Exception {
        var handler = new CsrfTokenRequestAttributeHandler();
        // Plain token values from health/cookie are echoed by the same-origin SPA header.
        http.csrf(csrf -> csrf.csrfTokenRepository(tokens).csrfTokenRequestHandler(handler));
        http.securityContext(context -> context.securityContextRepository(repository).requireExplicitSave(true));
        http.sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()));
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/login").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll());
        http.exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) ->
                        writeError(response, mapper, 401, "로그인이 필요합니다."))
                .accessDeniedHandler((request, response, error) -> {
                    var actor = SecurityContextHolder.getContext().getAuthentication();
                    boolean anonymous = actor == null || actor instanceof AnonymousAuthenticationToken;
                    boolean publicMutation = request.getRequestURI().equals("/api/auth/signup")
                            || request.getRequestURI().equals("/api/auth/login");
                    int status = anonymous && !publicMutation ? 401 : 403;
                    writeError(response, mapper, status,
                            status == 401 ? "로그인이 필요합니다." : "요청 검증에 실패했습니다.");
                }));
        // Feature controllers own login/logout; prevent Spring's default HTML/form endpoints.
        http.formLogin(form -> form.disable()).httpBasic(basic -> basic.disable()).logout(logout -> logout.disable());
        return http.build();
    }

    private static void writeError(HttpServletResponse response, ObjectMapper mapper, int status,
            String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getWriter(), ApiError.of(Integer.toString(status), message, null));
    }
}
