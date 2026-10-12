package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.common.HtmlCsrfController;
import com.resumecraft.common.HtmlCsrfService;
import com.resumecraft.photos.PhotoController;
import com.resumecraft.photos.PhotoMapper;
import com.resumecraft.photos.PhotoRecord;
import com.resumecraft.photos.PhotoService;
import com.resumecraft.resumes.ResumeController;
import com.resumecraft.resumes.ResumeMapper;
import com.resumecraft.resumes.ResumeRecord;
import com.resumecraft.resumes.ResumeService;
import com.resumecraft.resumes.ResumeStructureValidator;
import com.resumecraft.security.SecurityConfig;
import com.resumecraft.security.SessionAuthentication;
import jakarta.servlet.http.Cookie;
import java.time.OffsetDateTime;
import java.util.HashMap;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({AuthController.class, HtmlCsrfController.class, ResumeController.class, PhotoController.class})
@Import({SecurityConfig.class, SessionAuthentication.class, ApiExceptionHandler.class, AuthService.class,
    ResumeService.class, ResumeStructureValidator.class, PhotoService.class, HtmlCsrfService.class})
class AuthIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;
    @MockBean AuthMapper mapper;
    @MockBean ResumeMapper resumes;
    @MockBean PhotoMapper photos;
    final Map<String, AuthAccount> rows = new HashMap<>();
    final UUID jiwoo = UUID.fromString("10000000-0000-4000-8000-000000000001");
    final UUID other = UUID.fromString("10000000-0000-4000-8000-000000000002");
    final UUID resumeId = UUID.fromString("20000000-0000-4000-8000-000000000001");

    @BeforeEach
    void accounts() {
        rows.clear();
        rows.put("jiwoo@resume.dev", new AuthAccount(jiwoo, "jiwoo@resume.dev", "지우", passwords.encode("demo1234")));
        when(mapper.findByEmail(anyString())).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(mapper.findById(any(UUID.class))).thenAnswer(call -> rows.values().stream()
            .filter(row -> row.id().equals(call.getArgument(0))).findFirst().orElse(null));
        when(mapper.insert(any(AuthAccount.class))).thenAnswer(call -> {
            AuthAccount account = call.getArgument(0);
            if (rows.containsKey(account.email())) {
                throw new DuplicateKeyException("private SQL details");
            }
            rows.put(account.email(), account);
            return 1;
        });
    }

    Cookie token(MockHttpSession session) throws Exception {
        return mvc.perform(get("/").session(session)).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }

    MockHttpSession login() throws Exception {
        return login("jiwoo@resume.dev", "demo1234");
    }

    MockHttpSession login(String email, String password) throws Exception {
        var session = new MockHttpSession();
        Cookie csrf = token(session);
        String input = json.writeValueAsString(Map.of("email", email, "password", password));
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content(input))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        return session;
    }

    ResumeRecord ownedResume(UUID owner) throws Exception {
        var record = new ResumeRecord(resumeId, "비공개 이력서", "classic",
            json.readTree("{\"color\":\"#1F3A5F\",\"font\":\"pretendard\",\"size\":\"medium\"}"),
            json.readTree("""
                [{"type":"basics","hidden":false,"data":{"name":"","jobTitle":"",
                  "email":"owner@resume.dev","phone":"","photoId":null,"links":[]}}]
                """), OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        when(resumes.find(eq(resumeId), any(UUID.class))).thenAnswer(call ->
            owner.equals(call.getArgument(1)) ? record : null);
        return record;
    }

    @Test
    @DisplayName("[happy/auth/side-effect] login rotates spring security session without changing users/password_hash")
    void loginRotatesSessionAndReadsOnlyPersistedNicknameWithoutWrites() throws Exception {
        var session = new MockHttpSession();
        String before = session.getId();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content("""
                    {"email":"jiwoo@resume.dev","password":"demo1234"}
                    """))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(session.getId()).isNotEqualTo(before);
        mvc.perform(get("/api/auth/me").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.nickname").value("지우"))
            .andExpect(jsonPath("$.data.email").doesNotExist())
            .andExpect(jsonPath("$.data.password_hash").doesNotExist());
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(mapper, never()).insert(any());
    }

    @Test
    @DisplayName("[happy/auth/side-effect] signup stores BCrypt users/password_hash and starts spring security session")
    void signupPersistsBCryptAndAutomaticallyAuthenticates() throws Exception {
        var session = new MockHttpSession();
        String before = session.getId();
        AuthAccount existing = rows.get("jiwoo@resume.dev");
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/signup").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content("""
                    {"email":"new@resume.dev","nickname":"새사용자","password":"newpass123"}
                    """))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(session.getId()).isNotEqualTo(before);
        AuthAccount saved = rows.get("new@resume.dev");
        assertThat(saved).isNotNull();
        assertThat(saved.id()).isNotNull().isNotEqualTo(jiwoo);
        assertThat(saved.email()).isEqualTo("new@resume.dev");
        assertThat(saved.nickname()).isEqualTo("새사용자");
        assertThat(rows).hasSize(2).containsEntry("jiwoo@resume.dev", existing);
        assertThat(passwords).isInstanceOf(BCryptPasswordEncoder.class);
        assertThat(saved.passwordHash()).matches("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$");
        assertThat(saved.passwordHash()).isNotEqualTo("newpass123");
        assertThat(passwords.matches("newpass123", saved.passwordHash())).isTrue();
        assertThat(new BCryptPasswordEncoder().matches("newpass123", saved.passwordHash())).isTrue();
        assertThat(passwords.matches("wrongpass123", saved.passwordHash())).isFalse();
        verify(mapper).insert(saved);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.nickname").value("새사용자"))
            .andExpect(jsonPath("$.data.password_hash").doesNotExist());
        when(resumes.list(saved.id())).thenReturn(java.util.List.of());
        mvc.perform(get("/api/resumes").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").isEmpty());
        verify(resumes).list(saved.id());
        verifyNoMoreInteractions(resumes);
    }

    @ParameterizedTest
    @DisplayName("[validation/side-effect] signup rejects invalid fields without inserting users/password_hash")
    @CsvSource({"abc@,지우,demo1234,email", "valid@resume.dev,가,demo1234,nickname",
        "valid@resume.dev,가나다라마바사아자차카타파,demo1234,nickname", "valid@resume.dev,지우,1234567,password"})
    void invalidSignupIdentifiesFieldAndNeverWrites(String email, String nickname, String password, String field)
            throws Exception {
        var session = new MockHttpSession();
        Cookie csrf = token(session);
        String input = json.writeValueAsString(Map.of("email", email, "nickname", nickname, "password", password));
        mvc.perform(post("/api/auth/signup").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content(input))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field))
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.meta").isMap());
        verifyNoInteractions(mapper);
        assertThat(rows).hasSize(1);
    }

    @Test
    @DisplayName("[business/side-effect] duplicate signup preserves users/password_hash and leaves security anonymous")
    void duplicateSignupIncludingInsertRaceReturns409WithoutSession() throws Exception {
        var session = new MockHttpSession();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/signup").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content("""
                    {"email":"jiwoo@resume.dev","nickname":"새별명","password":"demo1234"}
                    """))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"))
            .andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다"))
            .andExpect(jsonPath("$.field").value("email"));
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("[validation] login missing email fails before users credential lookup")
    void missingLoginEmailReturns400WithoutCredentialLookup() throws Exception {
        var session = new MockHttpSession();
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content("{\"password\":\"demo1234\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        verifyNoInteractions(mapper);
    }

    @ParameterizedTest
    @DisplayName("[auth/business/side-effect] login rejects absent users or wrong password_hash without access")
    @CsvSource({"absent@resume.dev,wrong", "jiwoo@resume.dev,wrong"})
    void invalidCredentialsHaveSame401AndNoWrites(String email, String password) throws Exception {
        var session = new MockHttpSession();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        Cookie csrf = token(session);
        String input = json.writeValueAsString(Map.of("email", email, "password", password));
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content(input))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.message").value("인증 정보를 확인해 주세요."))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        verify(mapper, never()).insert(any());
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes/{id}", resumeId).session(session)).andExpect(status().isUnauthorized());
        verifyNoInteractions(resumes);
    }

    @Test
    @DisplayName("[auth/business] login spring security principal cannot read another users resume")
    void loginCannotReadAnotherUsersResume() throws Exception {
        rows.put("other@resume.dev", new AuthAccount(other, "other@resume.dev", "다른사용자",
            passwords.encode("otherpass123")));
        ResumeRecord foreign = ownedResume(other);
        var beforeContent = foreign.content().deepCopy();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        var session = new MockHttpSession();
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType("application/json").content("""
                    {"email":"jiwoo@resume.dev","password":"demo1234"}
                    """))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/resumes/{id}", resumeId).session(session).param("owner", other.toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.data").doesNotExist());
        verify(resumes).find(resumeId, jiwoo);
        verifyNoMoreInteractions(resumes);
        mvc.perform(get("/api/resumes/{id}", resumeId).session(login("other@resume.dev", "otherpass123")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(resumeId.toString()))
            .andExpect(jsonPath("$.data.title").value("비공개 이력서"))
            .andExpect(jsonPath("$.data.content[0].data.email").value("owner@resume.dev"));
        assertThat(foreign.content()).isEqualTo(beforeContent);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(mapper, never()).insert(any());
    }

    @Test
    @DisplayName("[business/side-effect] login cannot rename another users resume through real controller/service")
    void loginCannotRenameAnotherUsersResume() throws Exception {
        rows.put("other@resume.dev", new AuthAccount(other, "other@resume.dev", "다른사용자",
            passwords.encode("otherpass123")));
        ResumeRecord foreign = ownedResume(other);
        var beforeContent = foreign.content().deepCopy();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        MockHttpSession session = login();
        Cookie csrf = token(session);
        mvc.perform(patch("/api/resumes/{id}", resumeId).session(session).cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType("application/json")
                .content("{\"title\":\"탈취한 제목\",\"owner\":\"10000000-0000-4000-8000-000000000002\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        verify(resumes).find(resumeId, jiwoo);
        verifyNoMoreInteractions(resumes);
        mvc.perform(get("/api/resumes/{id}", resumeId).session(login("other@resume.dev", "otherpass123")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("비공개 이력서"))
            .andExpect(jsonPath("$.data.content[0].data.email").value("owner@resume.dev"));
        assertThat(foreign.content()).isEqualTo(beforeContent);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(mapper, never()).insert(any());
    }

    @Test
    @DisplayName("[happy/business/side-effect] me uses spring security owner and preserves users/password_hash")
    void meIgnoresOtherUserIdAndLeavesAllUsersUnchanged() throws Exception {
        rows.put("other@resume.dev", new AuthAccount(other, "other@resume.dev", "다른사용자",
            passwords.encode("otherpass123")));
        MockHttpSession session = login();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        clearInvocations(mapper, resumes);
        mvc.perform(get("/api/auth/me").session(session).param("userId", other.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.nickname").value("지우"))
            .andExpect(jsonPath("$.data.email").doesNotExist())
            .andExpect(jsonPath("$.data.password_hash").doesNotExist())
            .andExpect(jsonPath("$.data.passwordHash").doesNotExist());
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(mapper).findById(jiwoo);
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(resumes);
    }

    @Test
    @DisplayName("[auth/business/side-effect] logout clears spring security, preserves users/password_hash and resumes")
    void logoutWithoutBodyInvalidatesSessionAndDoesNotTouchAccounts() throws Exception {
        MockHttpSession session = login();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        ownedResume(jiwoo);
        mvc.perform(get("/api/resumes/{id}", resumeId).session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("비공개 이력서"));
        Cookie csrf = token(session);
        clearInvocations(mapper, resumes);
        var response = mvc.perform(post("/api/auth/logout").session(session).cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()))
            .andExpect(status().isNoContent()).andExpect(content().string(""))
            .andReturn().getResponse();
        Cookie removedCsrf = response.getCookie("XSRF-TOKEN");
        assertThat(removedCsrf).isNotNull();
        assertThat(removedCsrf.getMaxAge()).isZero();
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes/{id}", resumeId)).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/resumes/{id}", resumeId).contentType("application/json")
                .content("{\"title\":\"로그아웃 후 변경\"}"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper, resumes);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        mvc.perform(get("/api/resumes/{id}", resumeId).session(login()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("비공개 이력서"));
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
    }

    @Test
    @DisplayName("[business/side-effect] logout preserves other spring security sessions and users")
    void logoutDoesNotInvalidateAnotherAuthenticatedSession() throws Exception {
        MockHttpSession session = login();
        MockHttpSession anotherSession = login();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        Cookie csrf = token(session);
        clearInvocations(mapper, resumes);
        mvc.perform(post("/api/auth/logout").session(session).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(session.isInvalid()).isTrue();
        assertThat(anotherSession.isInvalid()).isFalse();
        verifyNoInteractions(mapper, resumes);
        mvc.perform(get("/api/auth/me").session(anotherSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("지우"));
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(mapper).findById(jiwoo);
        verifyNoMoreInteractions(mapper);
    }

    @Test
    @DisplayName("[auth/side-effect] anonymous logout is rejected by spring security before users access")
    void anonymousLogoutIs401BeforeCsrfWithoutWrites() throws Exception {
        mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(mapper, resumes);
    }

    @Test
    @DisplayName("[auth] anonymous me is rejected by spring security without users lookup")
    void anonymousMeIs401WithoutLookup() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[auth] spring security rejects login without CSRF before users/password_hash lookup")
    void loginRejectsMissingCsrf() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[auth] spring security rejects signup without CSRF before users/password_hash insertion")
    void signupRejectsMissingCsrf() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[auth/business/side-effect] logout without CSRF preserves security session and users/password_hash")
    void authenticatedLogoutStillRequiresCsrf() throws Exception {
        MockHttpSession session = login();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        clearInvocations(mapper, resumes);
        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isForbidden());
        assertThat(session.isInvalid()).isFalse();
        verifyNoInteractions(mapper, resumes);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
    }

    @Test
    @DisplayName("business/side-effect: login/logout spring security preserves users, resume and photo storage")
    void loginAndLogoutPreserveResumeAndPhotoAcrossSessionChanges() throws Exception {
        UUID photoId = UUID.randomUUID();
        byte[] original = new byte[]{1, 2, 3, 4};
        var storedPhoto = new PhotoRecord(photoId, jiwoo, "image/png", original.clone());
        when(photos.findOwned(photoId, jiwoo)).thenReturn(storedPhoto);
        ResumeRecord storedResume = ownedResume(jiwoo);
        var resumeContent = storedResume.content().deepCopy();
        Map<String, AuthAccount> beforeUsers = Map.copyOf(rows);
        var session = new MockHttpSession();
        Cookie csrf = token(session);
        mvc.perform(post("/api/auth/login").session(session).cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType("application/json").content("""
                    {"email":"jiwoo@resume.dev","password":"demo1234"}
                    """))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        verifyNoInteractions(resumes, photos);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        mvc.perform(get("/api/photos/{id}", photoId).session(session))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(original));
        mvc.perform(get("/api/resumes/{id}", resumeId).session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(resumeId.toString()));
        csrf = token(session);
        clearInvocations(resumes, photos, mapper);
        mvc.perform(post("/api/auth/logout").session(session).cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/photos/{id}", photoId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes/{id}", resumeId)).andExpect(status().isUnauthorized());
        verifyNoInteractions(resumes, photos, mapper);
        MockHttpSession freshSession = login();
        mvc.perform(get("/api/photos/{id}", photoId).session(freshSession))
            .andExpect(status().isOk()).andExpect(content().bytes(original));
        mvc.perform(get("/api/resumes/{id}", resumeId).session(freshSession))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value(storedResume.title()));
        assertThat(storedResume.content()).isEqualTo(resumeContent);
        assertThat(storedPhoto.data()).isEqualTo(original);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(beforeUsers);
        verify(photos).findOwned(photoId, jiwoo);
        verifyNoMoreInteractions(photos);
        verify(resumes).find(resumeId, jiwoo);
        verifyNoMoreInteractions(resumes);
        verify(mapper, never()).insert(any());
    }

    @Test
    @DisplayName("[happy] durable classpath auth contract operation IDs correspond to a real spring me request")
    void fixtureNamesMatchActualAuthOperations() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(10000);
            Map<?, ?> contract = new Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options)).load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> signup = (Map<?, ?>) paths.get("/api/auth/signup");
            assertThat(((Map<?, ?>) signup.get("post")).get("operationId")).isEqualTo("signup");
            Map<?, ?> login = (Map<?, ?>) paths.get("/api/auth/login");
            assertThat(((Map<?, ?>) login.get("post")).get("operationId")).isEqualTo("login");
            Map<?, ?> logout = (Map<?, ?>) paths.get("/api/auth/logout");
            assertThat(((Map<?, ?>) logout.get("post")).get("operationId")).isEqualTo("logout");
            Map<?, ?> path = (Map<?, ?>) paths.get("/api/auth/me");
            assertThat(((Map<?, ?>) path.get("get")).get("operationId")).isEqualTo("getCurrentUser");
        }
        mvc.perform(get("/api/auth/me").session(login())).andExpect(status().isOk());
    }
}
