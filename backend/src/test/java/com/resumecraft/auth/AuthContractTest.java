package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.*;
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
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, SessionAuthentication.class, SignupService.class,
        LoginService.class, LogoutService.class})
class AuthContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordEncoder passwords;
    @MockBean AuthUserMapper users;
    private AuthAccount jiwoo;

    @BeforeEach
    void account() {
        jiwoo = new AuthAccount(UUID.randomUUID(), "jiwoo@resume.dev", "지우", passwords.encode("demo1234"));
        when(users.findByEmail("jiwoo@resume.dev")).thenReturn(jiwoo);
    }

    @Test
    void loginRotatesSessionAndMeOnlyExposesNickname() throws Exception {
        assertThat(new ClassPathResource("contracts/openapi.yaml").exists()).isTrue();
        var session = new MockHttpSession();
        String previous = session.getId();
        mvc.perform(post("/api/auth/login").session(session).with(csrf())
                .contentType("application/json").content(loginBody("jiwoo@resume.dev", "demo1234")))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"success":true,"meta":{}}
                        """, true));
        assertThat(session.getId()).isNotEqualTo(previous);
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(content().json("""
                        {"success":true,"meta":{},"data":{"nickname":"지우"}}
                        """, true));
        verify(users, never()).insert(any());
    }

    @Test
    void signupHashesTrimsEmailWithoutLowercasingAndAuthenticates() throws Exception {
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody(" Mixed@Example.dev ", "😀😀", "abcdefgh")))
                .andExpect(status().isCreated())
                .andExpect(content().json("""
                        {"success":true,"meta":{}}
                        """, true)).andReturn();
        var captor = org.mockito.ArgumentCaptor.forClass(AuthAccount.class);
        verify(users).insert(captor.capture());
        var account = captor.getValue();
        assertThat(account.email()).isEqualTo("Mixed@Example.dev");
        assertThat(account.passwordHash()).isNotEqualTo("abcdefgh");
        assertThat(passwords.matches("abcdefgh", account.passwordHash())).isTrue();
        mvc.perform(get("/api/auth/me").session((MockHttpSession) result.getRequest().getSession(false)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("😀😀"));
    }

    @ParameterizedTest
    @CsvSource({"bad,지우,abcdefgh,email", "a@b.dev,가,abcdefgh,nickname",
            "a@b.dev,가나다라마바사아자차카타파,abcdefgh,nickname", "a@b.dev,지우,abcdefg,password"})
    void eachSignupValidationRejectsWithoutInsert(String email, String nickname, String password, String field)
            throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody(email, nickname, password)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
                .andExpect(jsonPath("$.field").value(field));
        verify(users, never()).insert(any());
    }

    @ParameterizedTest
    @CsvSource({"가나", "가나다라마바사아자차카타", "😀😀😀😀😀😀😀😀😀😀😀😀"})
    void nicknameCodePointBoundariesAreAccepted(String nickname) throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("boundary@example.dev", nickname, "abcdefgh")))
                .andExpect(status().isCreated());
        verify(users).insert(any());
    }

    @Test
    void duplicateRaceIs409WithoutCredentialLeak() throws Exception {
        when(users.insert(any())).thenThrow(new DuplicateKeyException("internal SQL and credentials"));
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content(signupBody("jiwoo@resume.dev", "지우", "demo1234")))
                .andExpect(status().isConflict())
                .andExpect(content().json("""
                        {"success":false,"meta":{},"code":"DUPLICATE_EMAIL",
                         "message":"이미 가입된 이메일입니다","field":null}
                        """, true));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({"jiwoo@resume.dev,wrong-password", "absent@resume.dev,wrong-password"})
    void failedCredentialsHaveSameSafe401AndNoSession(String email, String password) throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content(loginBody(email, password)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("""
                        {"success":false,"meta":{},"code":"INVALID_STRUCTURE",
                         "message":"이메일 또는 비밀번호를 확인해 주세요.","field":null}
                        """, true)).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        verify(users, never()).insert(any());
    }

    @Test
    void missingLoginFieldIs400() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        verifyNoInteractions(users);
    }

    @ParameterizedTest
    @CsvSource({"/api/auth/login", "/api/auth/signup"})
    void malformedCredentialInputIsSafe400(String path) throws Exception {
        mvc.perform(post(path).with(csrf()).contentType("application/json").content("{broken"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
                .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        verifyNoInteractions(users);
    }

    @Test
    void numericCredentialFieldsAreNotCoercedToStrings() throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                .content("""
                        {"email":"new@example.dev","nickname":123,"password":"abcdefgh"}
                        """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verifyNoInteractions(users);
    }

    @Test
    void publicAuthStillRequiresCsrfCookieHeader() throws Exception {
        mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/signup").contentType("application/json")
                .content(signupBody("a@b.dev", "지우", "abcdefgh")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(users);
    }

    @Test
    void anonymousMeAndLogoutAre401AndDoNotCreateSession() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        var result = mvc.perform(post("/api/auth/logout").with(csrf()))
                .andExpect(status().isUnauthorized()).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void logoutInvalidatesSessionAndFutureProtectedAccess() throws Exception {
        var session = new MockHttpSession();
        mvc.perform(post("/api/auth/login").session(session).with(csrf()).contentType("application/json")
                .content(loginBody("jiwoo@resume.dev", "demo1234"))).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
                .andExpect(status().isOk()).andExpect(content().json("""
                        {"success":true,"meta":{}}
                        """, true));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        verify(users, never()).insert(any());
    }

    private String signupBody(String email, String nickname, String password) throws Exception {
        return json.writeValueAsString(Map.of("email", email, "nickname", nickname, "password", password));
    }

    private String loginBody(String email, String password) throws Exception {
        return json.writeValueAsString(Map.of("email", email, "password", password));
    }
}
