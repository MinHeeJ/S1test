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
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/** 공개 인증 경계와 HttpSession 보안. 역할 모델 없이 모든 보호 API는 로그인만 확인한다. */
@Configuration
@org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ObjectMapper mapper,
            SecurityContextRepository repository) throws Exception {
        var csrfRepository = new HttpSessionCsrfTokenRepository();
        csrfRepository.setHeaderName("X-CSRF-TOKEN");
        http.securityContext(context -> context.securityContextRepository(repository))
                .csrf(csrf -> csrf.csrfTokenRepository(csrfRepository)
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/signup", "/api/auth/login", "/api/health").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                writeError(mapper, response, 401, "UNAUTHORIZED", "로그인이 필요합니다."))
                        .accessDeniedHandler((request, response, exception) -> {
                            // Anonymous writes remain 401 even if CSRF rejects them before authorization.
                            var authentication = org.springframework.security.core.context.SecurityContextHolder
                                    .getContext().getAuthentication();
                            boolean authenticated = authentication != null && authentication.isAuthenticated()
                                    && !(authentication instanceof org.springframework.security.authentication
                                            .AnonymousAuthenticationToken);
                            boolean publicAuth = request.getRequestURI().endsWith("/api/auth/signup")
                                    || request.getRequestURI().endsWith("/api/auth/login");
                            boolean forbidden = authenticated || publicAuth;
                            // 익명 logout의 CSRF 거부가 새 인증/임시 세션을 남기지 않도록 한다.
                            if (!authenticated && request.getRequestURI().endsWith("/api/auth/logout")) {
                                var session = request.getSession(false);
                                if (session != null) session.invalidate();
                            }
                            writeError(mapper, response, forbidden ? 403 : 401,
                                    forbidden ? "FORBIDDEN" : "UNAUTHORIZED",
                                    forbidden ? "요청을 허용할 수 없습니다." : "로그인이 필요합니다.");
                        }))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .addFilterAfter(new CsrfHeaderFilter(), CsrfFilter.class);
        return http.build();
    }

    private static void writeError(
            ObjectMapper mapper, HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), ApiError.of(code, message, null));
    }

    /** GET /me bootstrap의 401 응답에도 token을 먼저 제공한다. 별도 token API는 만들지 않는다. */
    private static class CsrfHeaderFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(
                HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            String path = request.getRequestURI().substring(request.getContextPath().length());
            if ("GET".equals(request.getMethod()) && "/api/auth/me".equals(path)) {
                var token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
                if (token != null) {
                    response.setHeader(token.getHeaderName(), token.getToken());
                }
            }
            chain.doFilter(request, response);
        }
    }
}
