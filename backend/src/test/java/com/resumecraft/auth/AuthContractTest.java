package com.resumecraft.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.*;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.UserRow;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.yaml.snakeyaml.Yaml;

/** Real security/controllers/services with only the XML persistence boundary doubled. */
@WebMvcTest({LoginController.class, SignupController.class, LogoutController.class, CurrentUserController.class})
@Import({SecurityConfig.class, ApiErrorHandler.class, HealthController.class, SessionContext.class,
        SignupService.class, LoginService.class, LogoutService.class})
class AuthContractTest {
    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper json;
    @MockBean
    private UserMapper users;
    private final Map<Long, UserRow> rows = new HashMap<>();
    private final BCryptPasswordEncoder independentEncoder = new BCryptPasswordEncoder();

    @BeforeEach
    void retainActualPersistenceArguments() {
        rows.clear();
        var time = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        rows.put(1L, new UserRow(1L, "jiwoo@resume.dev", "지우", independentEncoder.encode("demo1234"), time, time));
        when(users.findByEmail(anyString())).thenAnswer(call -> rows.values().stream()
                .filter(row -> row.email().equals(call.getArgument(0))).findFirst().orElse(null));
        when(users.findById(anyLong())).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(users.insert(anyString(), anyString(), anyString())).thenAnswer(call -> {
            Long id = (long) rows.size() + 1;
            rows.put(id, new UserRow(id, call.getArgument(0), call.getArgument(1), call.getArgument(2), time, time));
            return id;
        });
    }

    @Test
    void loginEstablishesSameSessionMeAndPreservesCompleteAccountSnapshot() throws Exception {
        var before = Map.copyOf(rows);
        var session = new MockHttpSession();
        String original = session.getId();
        mvc.perform(mutation(post("/api/auth/login").session(session))
                        .content(json.writeValueAsString(Map.of("email", "jiwoo@resume.dev", "password", "demo1234"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data").doesNotExist());
        assertThat(session.getId()).isNotEqualTo(original);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("지우"))
                .andExpect(jsonPath("$.data.id").doesNotExist()).andExpect(jsonPath("$.data.email").doesNotExist())
                .andExpect(jsonPath("$.data.password_hash").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(users, never()).insert(anyString(), anyString(), anyString());
    }

    @Test
    void signupStoresIndependentBcryptAndAutoAuthenticatesThenCredentialsWork() throws Exception {
        var session = new MockHttpSession();
        mvc.perform(mutation(post("/api/auth/signup").session(session))
                        .content(json.writeValueAsString(Map.of("email", " New@resume.dev ",
                                "nickname", "새사용자", "password", "password8"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        var retained = rows.get(2L);
        assertThat(retained.email()).isEqualTo("New@resume.dev");
        assertThat(retained.passwordHash()).matches("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$");
        assertThat(independentEncoder.matches("password8", retained.passwordHash())).isTrue();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("새사용자"));
        var second = new MockHttpSession();
        mvc.perform(mutation(post("/api/auth/login").session(second))
                        .content(json.writeValueAsString(Map.of("email", retained.email(), "password", "password8"))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").session(second)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({"a@resume.dev,가,password8,nickname", "a@resume.dev,가나다라마바사아자차카타파,password8,nickname",
            "a@resume.dev,가입,passwor,password", "abc@,가입,password8,email"})
    void invalidSignupHasExactFieldAndNoWrites(String email, String nickname, String password, String field)
            throws Exception {
        mvc.perform(mutation(post("/api/auth/signup"))
                        .content(json.writeValueAsString(Map.of("email", email, "nickname", nickname,
                                "password", password))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.code").value("400"))
                .andExpect(jsonPath("$.field").value(field));
        assertThat(rows).hasSize(1);
        verify(users, never()).insert(anyString(), anyString(), anyString());
    }

    @Test
    void unicodeCodePointsNotUtf16UnitsSetSignupBoundaries() throws Exception {
        mvc.perform(mutation(post("/api/auth/signup"))
                        .content(json.writeValueAsString(Map.of("email", "unicode@resume.dev", "nickname", "😀😀",
                                "password", "😀😀😀😀😀😀😀😀"))))
                .andExpect(status().isOk());
    }

    @Test
    void duplicateSignupPreservesRowsAndReturnsDeclaredError() throws Exception {
        var before = Map.copyOf(rows);
        mvc.perform(mutation(post("/api/auth/signup"))
                        .content(json.writeValueAsString(Map.of("email", "jiwoo@resume.dev", "nickname", "가입",
                                "password", "password8"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다"));
        assertThat(rows).isEqualTo(before);
        verify(users, never()).insert(anyString(), anyString(), anyString());
    }

    @Test
    void racingUniqueConstraintFailureNeverEstablishesSessionOrLeaksSql() throws Exception {
        doThrow(new DuplicateKeyException("users secret")).when(users)
                .insert(anyString(), anyString(), anyString());
        var session = new MockHttpSession();
        mvc.perform(mutation(post("/api/auth/signup").session(session))
                        .content(json.writeValueAsString(Map.of("email", "race@resume.dev", "nickname", "가입",
                                "password", "password8"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다"));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        assertThat(rows).hasSize(1);
    }

    @Test
    void loginWrongPasswordAndUnknownEmailHaveIdenticalErrorsAndNoWrites() throws Exception {
        var before = Map.copyOf(rows);
        var wrong = mvc.perform(mutation(post("/api/auth/login"))
                        .content(json.writeValueAsString(Map.of("email", "jiwoo@resume.dev", "password", "wrong"))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401")).andReturn();
        var absent = mvc.perform(mutation(post("/api/auth/login"))
                        .content(json.writeValueAsString(Map.of("email", "absent@resume.dev", "password", "wrong"))))
                .andExpect(status().isUnauthorized()).andReturn();
        assertThat(json.readTree(absent.getResponse().getContentAsString()))
                .isEqualTo(json.readTree(wrong.getResponse().getContentAsString()));
        assertThat(rows).isEqualTo(before);
    }

    @Test
    void loginMissingRequiredFieldReturns400() throws Exception {
        mvc.perform(mutation(post("/api/auth/login")).content("{\"email\":\"jiwoo@resume.dev\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
    }

    @Test
    void meAnonymousReturns401AndDoesNotReadAccount() throws Exception {
        clearInvocations(users);
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(users);
    }

    @Test
    void logoutAnonymousReturns401WithoutCreatingAuthenticationSession() throws Exception {
        var result = mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized()).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void logoutInvalidatesCurrentSessionButNotAnotherAndAccountsStayUnchanged() throws Exception {
        var before = Map.copyOf(rows);
        var current = signIn();
        var other = signIn();
        clearInvocations(users);
        mvc.perform(mutation(post("/api/auth/logout").session(current)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").doesNotExist()).andExpect(cookie().maxAge("XSRF-TOKEN", 0));
        assertThat(current.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me").session(current)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes").session(current)).andExpect(status().isUnauthorized());
        verifyNoInteractions(users);
        mvc.perform(get("/api/auth/me").session(other)).andExpect(status().isOk());
        assertThat(other.isInvalid()).isFalse();
        assertThat(rows).isEqualTo(before);
    }

    @Test
    void publicLoginStillRequiresCsrfAndDoesNotWriteOnRejection() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verify(users, never()).insert(anyString(), anyString(), anyString());
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableContractFixtureDeclaresOwnedOperationsAndMeProjection() throws Exception {
        Map<String, Object> contract;
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new Yaml().load(stream);
        }
        var paths = (Map<String, Map<String, Map<String, Object>>>) contract.get("paths");
        assertThat(paths.get("/api/auth/signup").get("post").get("operationId")).isEqualTo("signup");
        assertThat(paths.get("/api/auth/login").get("post").get("operationId")).isEqualTo("login");
        assertThat(paths.get("/api/auth/logout").get("post").get("operationId")).isEqualTo("logout");
        assertThat(paths.get("/api/auth/me").get("get").get("operationId")).isEqualTo("getCurrentUser");
        mvc.perform(get("/api/auth/me").session(signIn())).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nickname").value("지우"));
    }

    private MockHttpSession signIn() throws Exception {
        var session = new MockHttpSession();
        mvc.perform(mutation(post("/api/auth/login").session(session))
                        .content(json.writeValueAsString(Map.of("email", "jiwoo@resume.dev", "password", "demo1234"))))
                .andExpect(status().isOk());
        return session;
    }

    private MockHttpServletRequestBuilder mutation(MockHttpServletRequestBuilder request) throws Exception {
        MvcResult bootstrap = mvc.perform(get("/api/health")).andReturn();
        var meta = json.readTree(bootstrap.getResponse().getContentAsString()).path("meta");
        return request.contentType("application/json").cookie(bootstrap.getResponse().getCookie("XSRF-TOKEN"))
                .header(meta.path("csrfHeaderName").asText(), meta.path("csrfToken").asText());
    }
}
