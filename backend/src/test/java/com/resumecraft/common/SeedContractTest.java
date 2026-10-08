package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.resumecraft.common.persistence.UserMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import static org.assertj.core.api.Assertions.assertThat;

class SeedContractTest extends PostgresTestSupport {
    @Test
    void seedUsersAuthenticateAndListsRespectOwnerAndDeletedState() throws Exception {
        try (var session = sessions.openSession()) {
            var users = session.getMapper(UserMapper.class);
            var resumes = session.getMapper(ResumeMapper.class);
            for (String email : new String[]{"jiwoo@resume.dev", "minjun@resume.dev", "seoyeon@resume.dev"}) {
                var user = users.findByEmail(email);
                assertThat(user).isNotNull();
                assertThat(new BCryptPasswordEncoder().matches("demo1234", user.passwordHash())).isTrue();
            }
            assertThat(resumes.findActiveByUserId(users.findByEmail("jiwoo@resume.dev").id())).hasSize(3);
            assertThat(resumes.findActiveByUserId(users.findByEmail("minjun@resume.dev").id())).hasSize(1);
            assertThat(resumes.findActiveByUserId(users.findByEmail("seoyeon@resume.dev").id())).isEmpty();
        }
        try (var connection = connection(); var statement = connection.createStatement()) {
            var photos = statement.executeQuery("SELECT count(*) FROM photo");
            photos.next();
            assertThat(photos.getInt(1)).isZero();
            var deleted = statement.executeQuery("SELECT count(*) FROM resume WHERE deleted = true");
            deleted.next();
            assertThat(deleted.getInt(1)).isEqualTo(1);
        }
    }

    @Test
    void seedJsonContainsAllKindsAndPreservesHiddenIncompleteFields() {
        try (var session = sessions.openSession()) {
            var user = session.getMapper(UserMapper.class).findByEmail("jiwoo@resume.dev");
            var rows = session.getMapper(ResumeMapper.class).findActiveByUserId(user.id());
            var full = rows.stream().filter(row -> row.title().equals("백엔드 개발자 이력서")).findFirst().orElseThrow();
            assertThat(full.template()).isEqualTo("modern");
            assertThat(full.style().get("color").asText()).isEqualTo("#1F3A5F");
            assertThat(full.content().size()).isEqualTo(8);
            assertThat(full.content().get(0).path("data").path("photoId").isNull()).isTrue();
            var draft = rows.stream().filter(row -> row.title().equals("작성 중인 이력서")).findFirst().orElseThrow();
            assertThat(draft.content().size()).isEqualTo(2);
            assertThat(draft.content().get(0).path("data").path("jobTitle").asText()).isEmpty();
            assertThat(draft.content().get(1).path("hidden").asBoolean()).isTrue();
            assertThat(draft.content().get(1).path("items").get(0).path("company").asText()).isEmpty();
        }
    }
}
