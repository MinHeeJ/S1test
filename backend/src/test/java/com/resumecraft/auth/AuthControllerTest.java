package com.resumecraft.auth;

import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real service/security HTTP tests with only persistence mocked; not a SQL durability claim. */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, AuthService.class})
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean UserMapper users;
    private UserRow account;

    @BeforeEach
    void accountFixture() {
        account = new UserRow(17L, "jiwoo@resume.dev", "지우", new BCryptPasswordEncoder().encode("demo1234"));
        when(users.findByEmail(account.email())).thenReturn(account);
        when(users.findById(account.id())).thenReturn(account);
    }

    @Test
    void signupIsPublicPersistsBcryptAndAuthenticatesGeneratedIdentity() throws Exception {
        AtomicReference<UserRow> retained = new AtomicReference<>();
        when(users.insert(anyString(), anyString(), anyString())).thenAnswer(call -> {
            retained.set(new UserRow(42L, call.getArgument(0), call.getArgument(1), call.getArgument(2)));
            return 42L;
        });
        when(users.findById(42L)).thenAnswer(call -> retained.get());
        var result = mvc.perform(post("/api/auth/signup").with(csrf())
                        .contentType("application/json")
                        .content(json.writeValueAsString(Map.of(
                                "email", "new@example.test", "nickname", "새회원", "password", "newpassword"))))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""))
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0))
                .andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        assertNotNull(session);
        var hash = retained.get().passwordHash();
        assertTrue(hash.matches("\\$2[aby]\\$\\d{2}\\$.{53}"));
        assertTrue(new BCryptPasswordEncoder().matches("newpassword", hash));
        assertNotEquals("newpassword", hash);
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":{\"nickname\":\"새회원\"}}", true));
        verify(users).insert(eq("new@example.test"), eq("새회원"), eq(hash));
        verify(users, never()).findByEmail("new@example.test");
        assertEquals("42", ((SecurityContext) session.getAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY)).getAuthentication().getName());
    }

    @ParameterizedTest
    @CsvSource({"abc@,지우,demo1234,email", "new@example.test,지,demo1234,nickname",
            "new@example.test,가나다라마바사아자차카타파,demo1234,nickname",
            "new@example.test,지우,1234567,password"})
    void invalidSignupDoesNotWrite(String email, String nickname, String password, String field) throws Exception {
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                        .content(json.writeValueAsString(Map.of(
                                "email", email, "nickname", nickname, "password", password))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("400"))
                .andExpect(jsonPath("$.field").value(field));
        verify(users, never()).insert(any(), any(), any());
    }

    @Test
    void nicknameCountsUnicodeCodePointsAndPreservesInput() throws Exception {
        when(users.insert(any(), any(), any())).thenReturn(45L);
        mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                        .content(json.writeValueAsString(Map.of(
                                "email", "unicode@example.test", "nickname", "😀".repeat(12), "password", "demo1234"))))
                .andExpect(status().isNoContent());
        verify(users).insert(eq("unicode@example.test"), eq("😀".repeat(12)), any());
    }

    @Test
    void duplicateEmailRaceReturnsExact409WithoutSessionOrLeak() throws Exception {
        when(users.insert(eq("jiwoo@resume.dev"), any(), any()))
                .thenThrow(new DuplicateKeyException("SQL password secret details"));
        var result = mvc.perform(post("/api/auth/signup").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\",\"nickname\":\"지우\",\"password\":\"demo1234\"}"))
                .andExpect(status().isConflict())
                .andExpect(content().json("""
                        {"success":false,"meta":{},"code":"DUPLICATE_EMAIL",
                         "message":"이미 가입된 이메일입니다","field":"email"}
                        """, true)).andReturn();
        assertNull(result.getRequest().getSession(false));
    }

    @Test
    void loginRotatesExistingSessionPersistsContextAndOnlyReadsAccount() throws Exception {
        var session = new MockHttpSession();
        String previousId = session.getId();
        mvc.perform(post("/api/auth/login").session(session).with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertNotEquals(previousId, session.getId());
        clearInvocations(users);
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"success\":true,\"meta\":{},\"data\":{\"nickname\":\"지우\"}}", true));
        verify(users).findById(17L);
        verifyNoMoreInteractions(users);
        assertEquals(account, users.findById(17L));
    }

    @Test
    void missingLoginEmailIs400AndDoesNotReadOrWriteAccounts() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"password\":\"demo1234\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("email"));
        verifyNoInteractions(users);
    }

    @Test
    void missingLoginPasswordIs400WithoutPersistenceCalls() throws Exception {
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("password"));
        verifyNoInteractions(users);
    }

    @Test
    void incorrectCredentialsAndUnknownAccountHaveIdentical401() throws Exception {
        var wrong = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"incorrect\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401")).andReturn();
        var unknown = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"absent@example.test\",\"password\":\"incorrect\"}"))
                .andExpect(status().isUnauthorized()).andReturn();
        assertEquals(wrong.getResponse().getContentAsString(), unknown.getResponse().getContentAsString());
        assertNull(wrong.getRequest().getSession(false));
        assertNull(unknown.getRequest().getSession(false));
        verify(users, never()).insert(any(), any(), any());
    }

    @Test
    void meWithoutSessionIs401AndNeverReadsAccounts() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(users);
    }

    @Test
    void anonymousLogoutPrioritizes401OverCsrfAndDoesNotTouchDatabase() throws Exception {
        mvc.perform(post("/api/auth/logout"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(users);
    }

    @Test
    void logoutWithoutBodyInvalidatesOnlyCurrentSessionAndClearsCookies() throws Exception {
        var first = loginSession();
        var second = loginSession();
        clearInvocations(users);
        mvc.perform(post("/api/auth/logout").session(first).with(csrf()))
                .andExpect(status().isNoContent()).andExpect(content().string(""))
                .andExpect(cookie().maxAge("XSRF-TOKEN", 0))
                .andExpect(cookie().maxAge("JSESSIONID", 0));
        assertTrue(first.isInvalid());
        verifyNoInteractions(users);
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").session(second))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("지우"));
        assertEquals(account, users.findById(17L));
    }

    @Test
    void authenticatedLogoutRequiresCsrfAndRetainsSessionOnRejection() throws Exception {
        var session = loginSession();
        clearInvocations(users);
        mvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        assertFalse(session.isInvalid());
        verifyNoInteractions(users);
    }

    @Test
    void publicSignupAndLoginStillRequireCsrf() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(users);
    }

    @Test
    void persistenceFailureDoesNotLeakCredentialsOrEstablishSession() throws Exception {
        when(users.findByEmail(any())).thenThrow(new IllegalStateException("password SQL secret"));
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("요청을 처리하지 못했습니다.")).andReturn();
        assertNull(result.getRequest().getSession(false));
    }

    @Test
    void durableContractHasTheFourActualOperationIds() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            Map<?, ?> contract = yaml.load(input);
            var paths = (Map<?, ?>) contract.get("paths");
            for (var entry : Map.of("signup", "signup", "login", "login", "logout", "logout", "me", "getCurrentUser")
                    .entrySet()) {
                var path = (Map<?, ?>) paths.get("/api/auth/" + entry.getKey());
                var operation = (Map<?, ?>) path.get(entry.getKey().equals("me") ? "get" : "post");
                assertEquals(entry.getValue(), operation.get("operationId"));
            }
        }
    }

    private MockHttpSession loginSession() throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"jiwoo@resume.dev\",\"password\":\"demo1234\"}"))
                .andExpect(status().isNoContent()).andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
