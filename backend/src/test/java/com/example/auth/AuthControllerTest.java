package com.example.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.common.ApiErrorHandler;
import com.example.common.SecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

@WebMvcTest(
    controllers = AuthController.class,
    excludeAutoConfiguration =
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@ContextConfiguration(classes = AuthController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, AuthService.class})
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder encoder;
    @MockBean AuthMapper mapper;
    private final Map<UUID, AuthUser> rows = new HashMap<>();
    private AuthUser jiwoo;

    // Use the SPA's genuine cookie/header protocol, without swapping the application CSRF repository.
    private static org.springframework.test.web.servlet.request.RequestPostProcessor spaCsrf() {
        return request -> {
            request.setCookies(new jakarta.servlet.http.Cookie("XSRF-TOKEN", "test-token"));
            request.addHeader("X-XSRF-TOKEN", "test-token");
            return request;
        };
    }

    @BeforeEach
    void persistenceBoundary() {
        rows.clear();
        jiwoo = new AuthUser();
        jiwoo.setId(UUID.randomUUID());
        jiwoo.setEmail("jiwoo@resume.dev");
        jiwoo.setNickname("지우");
        jiwoo.setPasswordHash(encoder.encode("demo1234"));
        rows.put(jiwoo.getId(), jiwoo);
        when(mapper.findByEmail(any())).thenAnswer(call -> rows.values().stream()
            .filter(row -> row.getEmail().equals(call.getArgument(0))).findFirst().orElse(null));
        when(mapper.findById(any())).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(mapper.insert(any())).thenAnswer(call -> {
            AuthUser row = call.getArgument(0);
            if (rows.values().stream().anyMatch(existing -> existing.getEmail().equals(row.getEmail()))) {
                throw new DuplicateKeyException("users email unique");
            }
            rows.put(row.getId(), row);
            return 1;
        });
    }

    @Test
    void loginEstablishesUuidSessionAndMeReadsOnlyNicknameWithoutChangingHash() throws Exception {
        String hash = jiwoo.getPasswordHash();
        var old = new MockHttpSession();
        String oldId = old.getId();
        var result = mvc.perform(post("/api/auth/login").session(old).with(spaCsrf())
            .contentType("application/json")
            .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
            .andExpect(status().isOk()).andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
            .andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session.getId()).isNotEqualTo(oldId);
        assertThat(result.getResponse().getCookie("XSRF-TOKEN")).isNotNull();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":{\"nickname\":\"지우\"}}", true));
        assertThat(jiwoo.getPasswordHash()).isEqualTo(hash);
        verify(mapper, never()).insert(any());
    }

    @Test
    void signupPersistsBcryptTrimmedCasePreservingEmailAndAutomaticallyAuthenticates() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json")
            .content(json.writeValueAsString(Map.of(
                "email", "  New@resume.dev  ", "nickname", "😀😀", "password", " exact pass "))))
            .andExpect(status().isOk()).andExpect(content().json("{\"success\":true,\"meta\":{}}", true))
            .andReturn();
        AuthUser row = rows.values().stream().filter(user -> user != jiwoo).findFirst().orElseThrow();
        assertThat(row.getEmail()).isEqualTo("New@resume.dev");
        assertThat(row.getPasswordHash()).isNotEqualTo(" exact pass ").startsWith("$2");
        assertThat(encoder.matches(" exact pass ", row.getPasswordHash())).isTrue();
        mvc.perform(get("/api/auth/me").session((MockHttpSession) result.getRequest().getSession(false)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("😀😀"))
            .andExpect(jsonPath("$.data.password_hash").doesNotExist());
        mvc.perform(post("/api/auth/login").with(spaCsrf()).contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", row.getEmail(), "password", " exact pass "))))
            .andExpect(status().isOk());
        assertThat(rows).hasSize(2);
    }

    @ParameterizedTest
    @CsvSource({"a,abcdefgh,nickname", "abcdefghijklm,abcdefgh,nickname", "지우,1234567,password"})
    void signupLengthRulesRejectBeforeInsert(String nickname, String password, String field) throws Exception {
        mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json")
            .content(json.writeValueAsString(Map.of("email", "new@resume.dev", "nickname", nickname,
                "password", password))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field))
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.meta").isMap());
        verify(mapper, never()).insert(any());
        assertThat(rows).hasSize(1);
    }

    @Test
    void signupInvalidEmailDoesNotCreateAccountOrSession() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"abc@\",\"nickname\":\"지우\",\"password\":\"abcdefgh\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email")).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        verify(mapper, never()).insert(any());
    }

    @Test
    void duplicateSignupHasExactConflictAndNoAdditionalRowOrSession() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"jiwoo@resume.dev\",\"nickname\":\"지우\",\"password\":\"abcdefgh\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
            .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다")).andReturn();
        assertThat(rows).hasSize(1);
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void failedLoginDoesNotRevealWhetherEmailExists() throws Exception {
        var known = mvc.perform(post("/api/auth/login").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized()).andReturn();
        var unknown = mvc.perform(post("/api/auth/login").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"absent@resume.dev\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized()).andReturn();
        assertThat(known.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
        assertThat(known.getRequest().getSession(false)).isNull();
        verify(mapper, never()).insert(any());
    }

    @Test
    void loginMissingPasswordIs400WithoutCredentialLookup() throws Exception {
        mvc.perform(post("/api/auth/login").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"jiwoo@resume.dev\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
        verify(mapper, never()).findByEmail(any());
    }

    @Test
    void malformedSignupIs400AndDoesNotLeakContent() throws Exception {
        mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json").content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("400"));
        verify(mapper, never()).insert(any());
    }

    @Test
    void databaseFailureIsSanitizedAndNeverAuthenticates() throws Exception {
        doThrow(new IllegalStateException("secret SQL password_hash")).when(mapper).insert(any());
        var result = mvc.perform(post("/api/auth/signup").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"new@resume.dev\",\"nickname\":\"지우\",\"password\":\"abcdefgh\"}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500")).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("secret", "SQL", "password_hash");
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void logoutInvalidatesSessionAndLeavesAccountsUnchanged() throws Exception {
        var authenticated = mvc.perform(post("/api/auth/login").with(spaCsrf()).contentType("application/json")
            .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
            .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) authenticated.getRequest().getSession(false);
        mvc.perform(post("/api/auth/logout").session(session).with(spaCsrf()))
            .andExpect(status().isOk()).andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        assertThat(rows).hasSize(1);
        verify(mapper, never()).insert(any());
    }

    @Test
    void anonymousLogoutIs401AndCreatesNoSession() throws Exception {
        var result = mvc.perform(post("/api/auth/logout"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401")).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousMeIs401AndDoesNotQueryAccount() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(mapper);
    }

    @Test
    void publicLoginWithoutCsrfIs403BeforeCredentials() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(mapper);
    }

    @Test
    void publicSignupWithoutCsrfIs403BeforeInsert() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verifyNoInteractions(mapper);
    }

    @Test
    void durableContractDefinesImplementedOperationsAndMinimalUserShape() throws Exception {
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<String, Object> document = new Yaml().load(stream);
            var paths = (Map<?, ?>) document.get("paths");
            var me = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/auth/me")).get("get");
            assertThat(me.get("operationId")).isEqualTo("getCurrentUser");
            for (var name : new String[]{"signup", "login", "logout"}) {
                var operation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/auth/" + name)).get("post");
                assertThat(operation.get("operationId")).isEqualTo(name);
            }
            var schemas = (Map<?, ?>) ((Map<?, ?>) document.get("components")).get("schemas");
            var properties = (Map<?, ?>) ((Map<?, ?>) schemas.get("CurrentUser")).get("properties");
            assertThat(properties.keySet().toArray()).containsExactly("nickname");
        }
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }
}
