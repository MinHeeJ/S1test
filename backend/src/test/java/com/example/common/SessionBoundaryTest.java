package com.example.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class SessionBoundaryTest {
    @Test
    void authenticationRotatesExistingSessionAndClearsPreviousCsrfCookie() {
        var config = new SecurityConfig();
        var repository = config.csrfTokenRepository();
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        String previousId = request.getSession().getId();
        repository.saveToken(repository.generateToken(request), request, response);
        request.setCookies(response.getCookie("XSRF-TOKEN"));
        var principal = UsernamePasswordAuthenticationToken.authenticated(UUID.randomUUID(), null, List.of());
        config.sessionAuthenticationStrategy(repository).onAuthentication(principal, request, response);
        assertThat(request.getSession().getId()).isNotEqualTo(previousId);
        var cookies = response.getCookies();
        assertThat(cookies[cookies.length - 1].getName()).isEqualTo("XSRF-TOKEN");
        assertThat(cookies[cookies.length - 1].getMaxAge()).isZero();
    }

    @Test
    void explicitContextSaveMakesUuidPrincipalAvailableOnNextSessionRequest() {
        var repository = new SecurityConfig().securityContextRepository();
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        var identity = UUID.randomUUID();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(identity, null, List.of()));
        repository.saveContext(context, request, response);
        var next = new MockHttpServletRequest();
        next.setSession(request.getSession(false));
        assertThat(repository.loadDeferredContext(next).get().getAuthentication().getPrincipal()).isEqualTo(identity);
    }
}
