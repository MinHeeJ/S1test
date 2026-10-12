package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.common.SecurityConfig;
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
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controllers, services, BCrypt, session and filters; only the persistence boundary is doubled. */
@org.springframework.test.context.ContextConfiguration(classes = com.resumecraft.common.ResumeCraftApplication.class)
@WebMvcTest({LoginController.class, SignupController.class, LogoutController.class, CurrentUserController.class})
@Import({SecurityConfig.class, ApiExceptionHandler.class, LoginService.class, SignupService.class,
    AuthSessionService.class, LoginController.class, SignupController.class, LogoutController.class,
    CurrentUserController.class})
class AuthContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;
    @MockBean AuthMapper mapper;
    private Map<UUID, AuthAccount> accounts;
    private AuthAccount jiwoo;

    @BeforeEach
    void persistenceBoundary() {
        accounts = new HashMap<>();
        jiwoo = new AuthAccount(UUID.randomUUID(), "jiwoo@resume.dev", "지우", passwords.encode("demo1234"));
        accounts.put(jiwoo.id(), jiwoo);
        when(mapper.findByEmail(anyString())).thenAnswer(call -> accounts.values().stream()
            .filter(account -> account.email().equals(call.getArgument(0))).findFirst().orElse(null));
        when(mapper.findById(any(UUID.class))).thenAnswer(call -> accounts.get(call.getArgument(0)));
        when(mapper.insert(any(AuthAccount.class))).thenAnswer(call -> {
            AuthAccount account = call.getArgument(0);
            accounts.put(account.id(), account);
            return 1;
        });
    }

    private MvcResult login() throws Exception {
        return mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", "jiwoo@resume.dev", "password", "demo1234"))))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""))
            .andReturn();
    }

    private MockHttpSession session(MvcResult result) {
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test
    void loginEstablishesUuidSessionAndMeWithoutChangingAccounts() throws Exception {
        var before = Map.copyOf(accounts);
        var result = login();
        mvc.perform(get("/api/auth/me").session(session(result)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.nickname").value("지우"))
            .andExpect(jsonPath("$.data.email").doesNotExist())
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
        SecurityContext context = (SecurityContext) session(result).getAttribute("SPRING_SECURITY_CONTEXT");
        assertThat(context.getAuthentication().getName()).isEqualTo(jiwoo.id().toString());
        assertThat(context.getAuthentication().getCredentials()).isNull();
        assertThat(accounts).isEqualTo(before);
        verify(mapper, never()).insert(any());
    }

    @Test
    void initial401TokenAuthorizesLoginAndFixationAndCsrfAreRotated() throws Exception {
        var initial = mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized()).andExpect(header().exists("X-CSRF-TOKEN")).andReturn();
        MockHttpSession anonymous = session(initial);
        String previousId = anonymous.getId();
        String token = initial.getResponse().getHeader("X-CSRF-TOKEN");
        mvc.perform(post("/api/auth/login").session(anonymous).header("X-CSRF-TOKEN", token)
                .contentType("application/json").content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
            .andExpect(status().isNoContent());
        assertThat(anonymous.getId()).isNotEqualTo(previousId);
        var me = mvc.perform(get("/api/auth/me").session(anonymous))
            .andExpect(status().isOk()).andReturn();
        assertThat(me.getResponse().getHeader("X-CSRF-TOKEN")).isNotEqualTo(token);
        mvc.perform(post("/api/auth/logout").session(anonymous).header("X-CSRF-TOKEN", token))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").session(anonymous)
                .header("X-CSRF-TOKEN", me.getResponse().getHeader("X-CSRF-TOKEN")))
            .andExpect(status().isNoContent());
    }

    @Test
    void loginMissingEmailReturnsFieldErrorWithoutWrites() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content("{\"password\":\"demo1234\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        verifyNoInteractions(mapper);
        assertThat(accounts.get(jiwoo.id()).passwordHash()).isEqualTo(jiwoo.passwordHash());
    }

    @Test
    void loginMissingPasswordReturnsFieldErrorWithoutWrites() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content("{\"email\":\"jiwoo@resume.dev\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @CsvSource({"jiwoo@resume.dev,wrong", "missing@example.test,demo1234"})
    void wrongOrUnknownCredentialsAreGeneric401AndNoAuthenticatedSession(String email, String password)
        throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email, "password", password))))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.field").isEmpty())
            .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호를 확인해주세요."))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password_hash", password, email);
        verify(mapper, never()).insert(any());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRequiresCsrfEvenThoughItIsPublic() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json")
                .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void meWithoutSessionReturnsErrorAndBootstrapTokenWithoutReadingAccounts() throws Exception {
        mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized()).andExpect(header().exists("X-CSRF-TOKEN"))
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("UNAUTHENTICATED")).andExpect(jsonPath("$.field").isEmpty());
        verifyNoInteractions(mapper);
    }

    @Test
    void meCannotUseANonexistentAccountPrincipal() throws Exception {
        mvc.perform(get("/api/auth/me").with(user(UUID.randomUUID().toString())))
            .andExpect(status().isUnauthorized());
        verify(mapper, never()).insert(any());
    }

    @Test
    void signupIsPublicPersistsBcyrptAndAutoLogsIn() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("{\"email\":\"new@example.test\",\"nickname\":\"새사용자\",\"password\":\"password123\"}"))
            .andExpect(status().isNoContent()).andExpect(content().string("")).andReturn();
        var saved = accounts.values().stream()
            .filter(a -> a.email().equals("new@example.test")).findFirst().orElseThrow();
        assertThat(saved.passwordHash()).isNotEqualTo("password123");
        assertThat(passwords.matches("password123", saved.passwordHash())).isTrue();
        mvc.perform(get("/api/auth/me").session(session(result)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("새사용자"));
        assertThat(accounts).hasSize(2);
    }

    @ParameterizedTest
    @CsvSource({"abc@,새사용자,password123,email", "ok@example.test,한,password123,nickname",
        "ok@example.test,새사용자,1234567,password", "space @example.test,새사용자,password123,email",
        "ok@example.test,abcdefghijklmn,password123,nickname"})
    void invalidSignupFieldDoesNotInsert(String email, String nickname, String password, String field)
        throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email, "nickname", nickname, "password", password))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field));
        verifyNoInteractions(mapper);
        assertThat(accounts).hasSize(1);
    }

    @ParameterizedTest
    @CsvSource({"email", "nickname", "password"})
    void missingSignupFieldDoesNotInsert(String field) throws Exception {
        var body = new HashMap<>(Map.of("email", "ok@example.test", "nickname", "새사용자", "password", "password123"));
        body.remove(field);
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(body)))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field));
        verifyNoInteractions(mapper);
    }

    @Test
    void duplicateSignupPreservesAccountAndReturns409() throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("{\"email\":\"jiwoo@resume.dev\",\"nickname\":\"변경시도\",\"password\":\"password123\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
            .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다"))
            .andExpect(jsonPath("$.field").value("email"));
        assertThat(accounts).containsEntry(jiwoo.id(), jiwoo).hasSize(1);
        verify(mapper, never()).insert(any());
    }

    @Test
    void racingSignupUniqueViolationDoesNotCreateSession() throws Exception {
        when(mapper.insert(any())).thenThrow(new DuplicateKeyException("secret users_email_key SQL"));
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("{\"email\":\"new@example.test\",\"nickname\":\"새사용자\",\"password\":\"password123\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL")).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("secret", "SQL");
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        assertThat(accounts).hasSize(1);
    }

    @Test
    void failedSignupNeverCreatesAuthenticatedSessionOrLeaksDatabaseFailure() throws Exception {
        when(mapper.insert(any())).thenThrow(new IllegalStateException("password_hash SQL secret"));
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("{\"email\":\"new@example.test\",\"nickname\":\"새사용자\",\"password\":\"password123\"}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password_hash", "SQL", "secret");
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithNoBodyInvalidatesSessionAndPreservesAccounts() throws Exception {
        var before = Map.copyOf(accounts);
        var active = session(login());
        clearInvocations(mapper);
        mvc.perform(post("/api/auth/logout").session(active).with(csrf()))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(active.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        assertThat(accounts).isEqualTo(before);
        verifyNoInteractions(mapper);
    }

    @Test
    void logoutWithoutSessionIs401AndCannotModifyAccounts() throws Exception {
        mvc.perform(post("/api/auth/logout").with(csrf()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
        assertThat(accounts).hasSize(1);
    }

    @Test
    void authenticatedLogoutWithoutCsrfDoesNotEndSession() throws Exception {
        var active = session(login());
        mvc.perform(post("/api/auth/logout").session(active)).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me").session(active)).andExpect(status().isOk());
    }

    @Test
    void classpathContractMatchesObservableNicknameAndBodylessAuthSuccess() throws Exception {
        var options = new org.yaml.snakeyaml.LoaderOptions();
        options.setMaxAliasesForCollections(1000);
        Map<?, ?> contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new org.yaml.snakeyaml.Yaml(options).load(input);
        }
        Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
        for (String path : new String[]{"/api/auth/signup", "/api/auth/login", "/api/auth/logout"}) {
            Map<?, ?> operation = (Map<?, ?>) ((Map<?, ?>) paths.get(path)).get("post");
            assertThat(((Map<?, ?>) operation.get("responses")).containsKey("204")).isTrue();
        }
        Map<?, ?> schemas = (Map<?, ?>) ((Map<?, ?>) contract.get("components")).get("schemas");
        var response = mvc.perform(get("/api/auth/me").session(session(login())))
            .andExpect(status().isOk()).andReturn();
        var data = json.readTree(response.getResponse().getContentAsString()).get("data");
        assertThat(data.size()).isEqualTo(1);
        assertThat(data.has("nickname")).isTrue();
        assertThat(((Map<?, ?>) schemas.get("CurrentUser")).get("required"))
            .isEqualTo(java.util.List.of("nickname"));
    }
}
