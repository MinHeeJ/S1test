package com.resumecraft.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.*;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.UserRow;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 실제 controller/service/security를 거치며 persistence 경계만 대역으로 둔다. SQL 실행 증거는 아니다. */
@SpringJUnitConfig(AuthContractTest.WebConfig.class)
@WebAppConfiguration
class AuthContractTest {
    @Autowired WebApplicationContext context;
    @Autowired UserMapper users;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;
    MockMvc mvc;
    Map<UUID, UserRow> rows;
    UserRow jiwoo;

    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ApiErrorHandler.class, SessionAuthentication.class,
            AuthController.class, AuthService.class})
    static class WebConfig {
        @Bean ObjectMapper objectMapper() {
            return new ObjectMapper().findAndRegisterModules();
        }
        @Bean UserMapper userMapper() {
            return mock(UserMapper.class);
        }
    }

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        reset(users);
        rows = new HashMap<>();
        Instant now = Instant.now();
        jiwoo = new UserRow(UUID.randomUUID(), "jiwoo@resume.dev", "지우",
                passwords.encode("demo1234"), now, now);
        rows.put(jiwoo.id(), jiwoo);
        when(users.findByEmail(anyString())).thenAnswer(call -> rows.values().stream()
                .filter(row -> row.email().equals(call.getArgument(0))).findFirst().orElse(null));
        when(users.findById(any(UUID.class))).thenAnswer(call -> rows.get(call.getArgument(0)));
        when(users.insert(any(UserRow.class))).thenAnswer(call -> {
            UserRow row = call.getArgument(0);
            rows.put(row.id(), row);
            return 1;
        });
    }

    private MvcResult bootstrap() throws Exception {
        return mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.data").doesNotExist()).andReturn();
    }

    private MvcResult write(String path, Object input, MvcResult bootstrap) throws Exception {
        return mvc.perform(post(path)
                        .session((MockHttpSession) bootstrap.getRequest().getSession(false))
                        .header("X-CSRF-TOKEN", bootstrap.getResponse().getHeader("X-CSRF-TOKEN"))
                        .contentType("application/json").content(json.writeValueAsBytes(input))).andReturn();
    }

    @Test
    void signupCreatesBcryptRowAndAutomaticSessionWithNicknameOnly() throws Exception {
        var token = bootstrap();
        var session = (MockHttpSession) token.getRequest().getSession(false);
        String previousId = session.getId();
        var result = write("/api/auth/signup", new SignupInput(" New@resume.dev ", "😀😀", "demo1234"), token);
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json.readTree(result.getResponse().getContentAsByteArray()).path("success").asBoolean()).isTrue();
        assertThat(rows).hasSize(2);
        UserRow created = rows.values().stream().filter(row -> !row.id().equals(jiwoo.id())).findFirst().orElseThrow();
        assertThat(created.email()).isEqualTo("New@resume.dev");
        assertThat(created.passwordHash()).isNotEqualTo("demo1234");
        assertThat(passwords.matches("demo1234", created.passwordHash())).isTrue();
        assertThat(session.getId()).isNotEqualTo(previousId);
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap())
                .andExpect(jsonPath("$.data.nickname").value("😀😀"))
                .andExpect(jsonPath("$.data", org.hamcrest.Matchers.aMapWithSize(1)));
    }

    @Test
    void loginUsesSameSessionWithoutUpdatingHash() throws Exception {
        var token = bootstrap();
        var result = write("/api/auth/login", new LoginInput(jiwoo.email(), "demo1234"), token);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(json.readTree(result.getResponse().getContentAsByteArray()).has("data")).isFalse();
        mvc.perform(get("/api/auth/me").session((MockHttpSession) result.getRequest().getSession(false)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.nickname").value("지우"));
        assertThat(rows.get(jiwoo.id())).isEqualTo(jiwoo);
        verify(users, never()).insert(any());
    }

    @Test
    void badCredentialsDoNotAuthenticateOrLeakSecrets() throws Exception {
        var token = bootstrap();
        var result = write("/api/auth/login", new LoginInput(jiwoo.email(), "wrong"), token);
        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        var body = json.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.path("code").asText()).isEqualTo("UNAUTHORIZED");
        assertThat(body.path("success").asBoolean()).isFalse();
        assertThat(body.path("meta").isObject()).isTrue();
        assertThat(body.path("field").isNull()).isTrue();
        assertThat(result.getResponse().getContentAsString()).doesNotContain(jiwoo.passwordHash(), "wrong");
        mvc.perform(get("/api/auth/me").session((MockHttpSession) token.getRequest().getSession(false)))
                .andExpect(status().isUnauthorized());
        verify(users, never()).insert(any());
    }

    @ParameterizedTest
    @CsvSource({"bad,지우,demo1234,email", "new@resume.dev,가,demo1234,nickname",
            "new@resume.dev,가나다라마바사아자차카타파,demo1234,nickname", "new@resume.dev,지우,1234567,password"})
    void invalidSignupDoesNotInsert(String email, String nickname, String password, String field) throws Exception {
        var token = bootstrap();
        var result = write("/api/auth/signup", new SignupInput(email, nickname, password), token);
        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(json.readTree(result.getResponse().getContentAsByteArray()).path("field").asText()).isEqualTo(field);
        assertThat(rows).hasSize(1);
        verify(users, never()).insert(any());
    }

    @Test
    void duplicateEmailIsConflictAndRowCountUnchanged() throws Exception {
        var result = write("/api/auth/signup", new SignupInput(jiwoo.email(), "지우", "demo1234"), bootstrap());
        assertThat(result.getResponse().getStatus()).isEqualTo(409);
        var body = json.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.path("code").asText()).isEqualTo("DUPLICATE_EMAIL");
        assertThat(body.path("message").asText()).isEqualTo("이미 가입된 이메일입니다");
        assertThat(rows).hasSize(1);
        verify(users, never()).insert(any());
    }

    @Test
    void uniqueRaceDoesNotEstablishAuthentication() throws Exception {
        when(users.insert(any())).thenThrow(new DuplicateKeyException("secret SQL"));
        var token = bootstrap();
        var result = write("/api/auth/signup", new SignupInput("new@resume.dev", "지우", "demo1234"), token);
        assertThat(result.getResponse().getStatus()).isEqualTo(409);
        assertThat(rows).hasSize(1);
        mvc.perform(get("/api/auth/me").session((MockHttpSession) token.getRequest().getSession(false)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesSessionAndCookieWithoutChangingRows() throws Exception {
        var token = bootstrap();
        var login = write("/api/auth/login", new LoginInput(jiwoo.email(), "demo1234"), token);
        var session = (MockHttpSession) login.getRequest().getSession(false);
        mvc.perform(post("/api/auth/logout").session(session)
                        .header("X-CSRF-TOKEN", token.getResponse().getHeader("X-CSRF-TOKEN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(cookie().maxAge("JSESSIONID", 0)).andExpect(cookie().httpOnly("JSESSIONID", true));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes").session(session)).andExpect(status().isUnauthorized());
        assertThat(rows).containsOnlyKeys(jiwoo.id());
        verify(users, never()).insert(any());
    }

    @Test
    void anonymousLogoutDoesNotCreateSession() throws Exception {
        var result = mvc.perform(post("/api/auth/logout"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void csrfCannotBeBypassedByPublicSignup() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType("application/json")
                        .content(json.writeValueAsBytes(new SignupInput("new@resume.dev", "지우", "demo1234"))))
                .andExpect(status().isForbidden());
        verify(users, never()).insert(any());
    }

    @Test
    void missingLoginFieldIsBadRequest() throws Exception {
        var result = write("/api/auth/login", Map.of("email", jiwoo.email()), bootstrap());
        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(json.readTree(result.getResponse().getContentAsByteArray()).path("field").asText())
                .isEqualTo("password");
    }

    @Test
    void fixtureDeclaresOwnedOperationAndMeNicknameProjection() throws Exception {
        var resource = new ClassPathResource("contracts/openapi.yaml");
        try (var stream = resource.getInputStream()) {
            var yaml = new org.yaml.snakeyaml.Yaml();
            Map<String, Object> document = yaml.load(stream);
            Map<?, ?> paths = (Map<?, ?>) document.get("paths");
            for (String path : new String[]{
                    "/api/auth/signup", "/api/auth/login", "/api/auth/logout", "/api/auth/me"}) {
                assertThat(paths.containsKey(path)).isTrue();
            }
        }
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }
}
