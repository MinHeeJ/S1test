package com.resumecraft.common;

import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "FOUNDATION_TEST_DB_URL", matches = ".+")
@SpringBootTest(properties = {
    "spring.datasource.url=${FOUNDATION_TEST_DB_URL}",
    "spring.datasource.username=${FOUNDATION_TEST_DB_USER:resumecraft}",
    "spring.datasource.password=${FOUNDATION_TEST_DB_PASSWORD:dev-only-password}"
})
class SeedContractTest {
    @Autowired UserMapper users;
    @Autowired ResumeMapper resumes;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;

    @Test
    void threeActorsCanAuthenticateAndObserveTheirOwnSeedScope() {
        for (String email : new String[] {"jiwoo@resume.dev", "minjun@resume.dev", "seoyeon@resume.dev"}) {
            var user = users.findByEmail(email);
            assertThat(user).isNotNull();
            assertThat(encoder.matches("demo1234", user.passwordHash())).isTrue();
        }
        var jiwoo = users.findByEmail("jiwoo@resume.dev");
        var list = resumes.listOwned(jiwoo.id(), 0, 20);
        assertThat(list).hasSize(3);
        var modern = list.stream().filter(row -> row.title().equals("백엔드 개발자 이력서")).findFirst().orElseThrow();
        assertThat(modern.template()).isEqualTo("modern");
        assertThat(modern.style().path("color").asText()).isEqualTo("#1F3A5F");
        assertThat(modern.content()).hasSize(8);
        assertThat(modern.content().get(0).path("data").path("photoId").isNull()).isTrue();
        var newGraduate = list.stream().filter(row -> row.title().equals("신입 지원용")).findFirst().orElseThrow();
        assertThat(newGraduate.content().get(2).path("items")).hasSize(1);
        assertThat(newGraduate.content().get(3).path("data").path("tags")).hasSize(5);
        assertThat(newGraduate.content().get(4).path("items")).hasSize(2);
        var draft = list.stream().filter(row -> row.title().equals("작성 중인 이력서")).findFirst().orElseThrow();
        assertThat(draft.content().get(0).path("data").path("jobTitle").asText()).isEmpty();
        assertThat(draft.content().get(1).path("hidden").asBoolean()).isTrue();
        assertThat(resumes.countOwned(users.findByEmail("minjun@resume.dev").id())).isEqualTo(1);
        assertThat(resumes.countOwned(users.findByEmail("seoyeon@resume.dev").id())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM photo", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM resume WHERE deleted = TRUE", Long.class)).isEqualTo(1);
    }
}
