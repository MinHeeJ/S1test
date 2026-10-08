package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiErrorHandler;
import com.resumecraft.common.SecurityConfig;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import com.resumecraft.common.persistence.ResumeRow;
import com.resumecraft.resumes.ResumeController;
import com.resumecraft.resumes.ResumeService;
import com.resumecraft.resumes.ResumeStructureValidator;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.UserRow;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP handlers, services, BCrypt and security; only the persistence boundary is doubled. */
@org.springframework.test.context.ContextConfiguration(classes = com.resumecraft.common.ResumeCraftApplication.class)
@WebMvcTest({SignupController.class, LoginController.class, LogoutController.class,
    CurrentUserController.class, ResumeController.class})
@Import({SecurityConfig.class, ApiErrorHandler.class, SignupService.class, LoginService.class,
    AuthSessionService.class, LogoutService.class, CurrentUserService.class,
    ResumeService.class, ResumeStructureValidator.class})
class AuthContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;
    @MockBean UserMapper users;
    @MockBean ResumeMapper resumes;
    @MockBean PhotoMapper photos;
    private final Map<UUID, ResumeRow> resumeRows = new LinkedHashMap<>();
    private final Map<String, UserRow> rows = new LinkedHashMap<>();

    @BeforeEach
    void setup() {
        rows.clear();
        resumeRows.clear();
        when(resumes.insert(any(ResumeRow.class))).thenAnswer(call -> {
            ResumeRow row = call.getArgument(0);
            resumeRows.put(row.id(), row);
            return 1;
        });
        when(resumes.listFilteredOwned(any(), anyInt(), anyInt(), nullable(String.class)))
            .thenAnswer(call -> resumeRows.values().stream()
                .filter(row -> row.userId().equals(call.getArgument(0)) && !row.deleted())
                .toList());
        when(users.findById(any(UUID.class))).thenAnswer(call -> rows.values().stream()
            .filter(row -> row.id().equals(call.getArgument(0))).findFirst().orElse(null));
        var now = OffsetDateTime.now();
        rows.put("jiwoo@resume.dev", new UserRow(UUID.randomUUID(), "jiwoo@resume.dev", "지우",
            passwords.encode("demo1234"), now, now));
        when(users.findByEmail(anyString())).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(users.insert(any(UserRow.class))).thenAnswer(call -> {
            UserRow row = call.getArgument(0);
            if (rows.containsKey(row.email())) throw new DuplicateKeyException("private SQL detail");
            rows.put(row.email(), row);
            return 1;
        });
    }

    @Test
    @DisplayName("side-effect: password_hash에 BCrypt 저장, Spring Security 인증으로 /api/resumes 접근")
    void signupCreatesBcryptAccountAndAuthenticatesSameSession() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("New@resume.dev", "새사용자", "abcdefgh")))
            .andExpect(status().isCreated())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true)).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        var security = (SecurityContext) session.getAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        var row = rows.get("New@resume.dev");
        assertThat(security.getAuthentication().isAuthenticated()).isTrue();
        assertThat(((SessionUser) security.getAuthentication().getPrincipal()).id()).isEqualTo(row.id());
        mvc.perform(get("/api/resumes").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(0));
        verify(resumes).listFilteredOwned(row.id(), 0, 20, null);
        assertThat(rows).hasSize(2);
        assertThat(row.passwordHash()).isNotEqualTo("abcdefgh").startsWith("$2");
        assertThat(passwords.matches("abcdefgh", row.passwordHash())).isTrue();
        assertThat(row.createdAt()).isEqualTo(row.updatedAt());
        mvc.perform(get("/api/auth/me").session((MockHttpSession) result.getRequest().getSession(false)))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":{\"nickname\":\"새사용자\"}}", true));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("New@resume.dev", "abcdefgh")))
            .andExpect(status().isOk());
        assertThat(rows.get("New@resume.dev")).isEqualTo(row);
    }

    @ParameterizedTest
    @CsvSource({"가,nickname", "가나다라마바사아자차카타파,nickname", "short,password"})
    void signupRejectsEachLengthViolationWithoutWrite(String value, String field) throws Exception {
        String nickname = field.equals("nickname") ? value : "가입자";
        String password = field.equals("password") ? value : "abcdefgh";
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("new@resume.dev", nickname, password)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("Bad Request"))
            .andExpect(jsonPath("$.field").value(field));
        verify(users, never()).insert(any());
        assertThat(rows).hasSize(1);
    }

    @ParameterizedTest
    @CsvSource({"'😀😀',abcdefgh", "가나다라마바사아자차카타,abcdefgh"})
    void signupAcceptsCodePointLengthBoundaries(String nickname, String password) throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("boundary@resume.dev", nickname, password)))
            .andExpect(status().isCreated());
        assertThat(rows.get("boundary@resume.dev").nickname()).isEqualTo(nickname);
    }

    @Test
    void signupRejectsInvalidEmailWithoutWrite() throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("abc@", "가입자", "abcdefgh")))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        verify(users, never()).insert(any());
    }

    @Test
    void signupDuplicateHasExactMessageAndNoWrite() throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("jiwoo@resume.dev", "가입자", "abcdefgh")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
            .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다"));
        verify(users, never()).insert(any());
        assertThat(rows).hasSize(1);
    }

    @Test
    void signupUniqueRaceDoesNotAuthenticateOrLeakSql() throws Exception {
        when(users.insert(any())).thenThrow(new DuplicateKeyException("private SQL detail"));
        var response = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("race@resume.dev", "가입자", "abcdefgh")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
            .andReturn();
        assertThat(response.getResponse().getContentAsString()).doesNotContain("private SQL detail");
        assertThat(rows).hasSize(1);
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("side-effect: login의 Security 세션 회전과 동일 세션 보호 API 접근, hash 불변")
    void loginSeedCredentialsEstablishNicknameAndDoNotMutateHash() throws Exception {
        var before = rows.get("jiwoo@resume.dev");
        var bootstrap = mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized()).andReturn();
        var session = (MockHttpSession) bootstrap.getRequest().getSession(false);
        String oldId = session.getId();
        mvc.perform(post("/api/auth/login").session(session)
                .header("X-CSRF-TOKEN", bootstrap.getResponse().getHeader("X-CSRF-TOKEN"))
                .contentType("application/json").content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
        assertThat(session.getId()).isNotEqualTo(oldId);
        var security = (SecurityContext) session.getAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(security.getAuthentication().isAuthenticated()).isTrue();
        assertThat(((SessionUser) security.getAuthentication().getPrincipal()).id()).isEqualTo(before.id());
        mvc.perform(get("/api/resumes").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").isArray());
        verify(resumes).listFilteredOwned(before.id(), 0, 20, null);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-CSRF-TOKEN"))
            .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":{\"nickname\":\"지우\"}}", true));
        assertThat(rows.get("jiwoo@resume.dev")).isEqualTo(before);
        verify(users, never()).insert(any());
    }

    @Test
    void loginWrongPasswordAndUnknownAccountShareFlat401() throws Exception {
        var wrong = rejectedLogin("jiwoo@resume.dev", "wrong").andReturn().getResponse().getContentAsString();
        var absent = rejectedLogin("absent@resume.dev", "wrong").andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(wrong)).isEqualTo(json.readTree(absent));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        verify(users, never()).insert(any());
    }

    @Test
    void loginDoesNotApplySignupLengthOrEmailValidation() throws Exception {
        var now = OffsetDateTime.now();
        rows.put("legacy", new UserRow(UUID.randomUUID(), "legacy", "기존", passwords.encode("x"), now, now));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("legacy", "x"))).andExpect(status().isOk());
    }

    @Test
    void loginMissingFieldIs400WithoutWrite() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content("{\"email\":\"jiwoo@resume.dev\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
        verify(users, never()).insert(any());
    }

    @Test
    void loginMalformedJsonDoesNotLeakCredentials() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Bad Request"));
        verifyNoInteractions(users);
    }

    @Test
    void loginRequiresCsrfEvenThoughPublic() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("Forbidden"));
        verifyNoInteractions(users);
    }

    @Test
    void signupRequiresCsrfEvenThoughPublic() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json")
                .content(signupBody("new@resume.dev", "가입자", "abcdefgh")))
            .andExpect(status().isForbidden());
        verifyNoInteractions(users);
    }

    @Test
    void getCurrentUserAnonymousReturns401WithCsrfHeaderAndNoData() throws Exception {
        mvc.perform(get("/api/auth/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(header().exists("X-CSRF-TOKEN"))
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("side-effect: logout이 Spring Security 세션을 무효화하고 계정과 이력서는 보존")
    void logoutInvalidatesSessionAndProtectsSubsequentReadsWithoutBusinessWrite() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234"))).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(post("/api/resumes").session(session).with(csrf()).contentType("application/json")
                .content("{\"title\":\"보존할 이력서\",\"template\":\"classic\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.id").isString());
        assertThat(resumeRows).hasSize(1);
        clearInvocations(resumes, photos);
        var before = Map.copyOf(rows);
        var resumeBefore = Map.copyOf(resumeRows);
        var security = (SecurityContext) session.getAttribute(
            HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        assertThat(security.getAuthentication().isAuthenticated()).isTrue();
        mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
        assertThat(session.isInvalid()).isTrue();
        assertThat(security.getAuthentication()).isNull();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes").session(session)).andExpect(status().isUnauthorized());
        assertThat(rows).isEqualTo(before);
        assertThat(resumeRows).isEqualTo(resumeBefore);
        verifyNoInteractions(resumes, photos);
        verify(users, never()).insert(any());
    }

    @Test
    void logoutWithoutAuthenticationIs401WithValidCsrf() throws Exception {
        mvc.perform(post("/api/auth/logout").with(csrf()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("Unauthorized"));
        verifyNoInteractions(users);
    }

    @Test
    void logoutAuthenticatedStillRequiresCsrf() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234"))).andReturn();
        mvc.perform(post("/api/auth/logout")
                .session((MockHttpSession) result.getRequest().getSession(false)))
            .andExpect(status().isForbidden());
    }

    @Test
    void persistenceFailureIsSanitizedAndDoesNotAuthenticate() throws Exception {
        when(users.findByEmail(anyString())).thenThrow(new IllegalStateException("private SQL detail"));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("Internal Server Error"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("happy: getCurrentUser는 세션 nickname 대신 users의 최신 nickname을 조회한다")
    void getCurrentUserReadsLatestPersistedNickname() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        var before = rows.get("jiwoo@resume.dev");
        rows.put(before.email(), new UserRow(before.id(), before.email(), "새닉네임",
            before.passwordHash(), before.createdAt(), before.updatedAt()));
        clearInvocations(users);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.nickname").value("새닉네임"))
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist())
            .andExpect(jsonPath("$.data.password_hash").doesNotExist())
            .andExpect(jsonPath("$.data.email").doesNotExist());
        verify(users).findById(before.id());
        verify(users, never()).insert(any());
    }

    @Test
    @DisplayName("auth: 세션 사용자 row가 없으면 getCurrentUser는 401이며 사용자 정보를 노출하지 않는다")
    void getCurrentUserRejectsStaleSessionWithoutAccount() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        var id = rows.get("jiwoo@resume.dev").id();
        rows.clear();
        clearInvocations(users);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("Unauthorized"))
            .andExpect(jsonPath("$.data").doesNotExist());
        verify(users).findById(id);
        verify(users, never()).insert(any());
    }

    @Test
    @DisplayName("getCurrentUser의 DB 오류는 내부 정보를 숨긴 500이며 세션 nickname으로 대체하지 않는다")
    void getCurrentUserDoesNotFallbackOnPersistenceFailure() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isOk()).andReturn();
        when(users.findById(any(UUID.class))).thenThrow(new IllegalStateException("private SQL detail"));
        mvc.perform(get("/api/auth/me")
                .session((MockHttpSession) result.getRequest().getSession(false)))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("Internal Server Error"))
            .andExpect(jsonPath("$.data").doesNotExist());
        verify(users, never()).insert(any());
    }

    @Test
    void durableContractIsLoadedFromClasspath() throws Exception {
        com.fasterxml.jackson.databind.JsonNode contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = json.valueToTree(new Yaml().load(input));
        }
        assertThat(contract.path("paths").path("/api/auth/me").path("get")
            .path("operationId").asText()).isEqualTo("getCurrentUser");
        var schema = contract.path("components").path("schemas").path("CurrentUser");
        assertThat(schema.path("required")).isEqualTo(json.readTree("[\"nickname\"]"));
        assertThat(schema.path("properties").path("nickname").path("type").asText()).isEqualTo("string");
        var login = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
            .andExpect(status().isOk()).andReturn();
        var response = mvc.perform(get("/api/auth/me")
                .session((MockHttpSession) login.getRequest().getSession(false)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.nickname").value(rows.get("jiwoo@resume.dev").nickname()))
            .andReturn();
        var data = json.readTree(response.getResponse().getContentAsByteArray()).path("data");
        assertThat(data.size()).isEqualTo(schema.path("properties").size());
        assertThat(data.path(schema.path("required").get(0).asText()).isTextual()).isTrue();
    }

    private ResultActions rejectedLogin(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody(email, password)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.code").value("Unauthorized"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.error").doesNotExist());
    }

    private String signupBody(String email, String nickname, String password) throws Exception {
        return json.writeValueAsString(Map.of("email", email, "nickname", nickname, "password", password));
    }

    private String loginBody(String email, String password) throws Exception {
        return json.writeValueAsString(Map.of("email", email, "password", password));
    }
}
