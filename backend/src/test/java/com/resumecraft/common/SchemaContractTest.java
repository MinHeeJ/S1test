package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "FOUNDATION_TEST_DB_URL", matches = ".+")
@SpringBootTest(properties = {
    "spring.datasource.url=${FOUNDATION_TEST_DB_URL}",
    "spring.datasource.username=${FOUNDATION_TEST_DB_USER:resumecraft}",
    "spring.datasource.password=${FOUNDATION_TEST_DB_PASSWORD:dev-only-password}"
})
@Transactional
class SchemaContractTest {
    @Autowired UserMapper users;
    @Autowired ResumeMapper resumes;
    @Autowired PhotoMapper photos;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    @Test
    void nativeJsonByteaUuidMaterializeAndOwnershipPreventsMutation() throws Exception {
        var now = OffsetDateTime.now();
        var owner = UUID.randomUUID();
        var stranger = UUID.randomUUID();
        users.insert(new UserRow(owner, owner + "@test.invalid", "검증", "test-hash", now, now));
        users.insert(new UserRow(stranger, stranger + "@test.invalid", "타인", "test-hash", now, now));
        var id = UUID.randomUUID();
        var style = json.readTree("""
            {"color":"#1F3A5F","font":"pretendard","size":"medium"}
            """);
        var content = json.readTree("""
            [{"type":"basics","hidden":false,"data":{"jobTitle":"","email":"abc@","photoId":null}},
             {"type":"experience","hidden":true,"items":[{"start":"2025.13","current":true}]}]
            """);
        assertThat(resumes.insert(new ResumeRow(id, owner, "왕복", "modern", style, content, false, now, now)))
            .isEqualTo(1);
        assertThat(resumes.findOwned(id, owner).content()).isEqualTo(content);
        assertThat(resumes.findOwned(id, stranger)).isNull();
        assertThat(resumes.renameOwned(id, stranger, "침범", now)).isZero();
        assertThat(resumes.updateOwned(id, owner, null, "classic", style, content, now)).isEqualTo(1);
        assertThat(resumes.findOwned(id, owner).title()).isEqualTo("왕복");
        var photoId = UUID.randomUUID();
        byte[] bytes = {1, 2, 3, 4};
        photos.insert(new PhotoRow(photoId, owner, "image/png", bytes, now));
        assertThat(photos.findOwned(photoId, owner).data()).containsExactly(bytes);
        assertThat(photos.findOwned(photoId, stranger)).isNull();
        assertThat(resumes.deleteOwned(id, owner, now)).isEqualTo(1);
        assertThat(resumes.findOwned(id, owner)).isNull();
        assertThat(resumes.renameOwned(id, owner, "복구", now)).isZero();
        assertThat(resumes.countOwned(owner)).isZero();
        assertThat(photos.findOwned(photoId, owner)).isNotNull();
    }

    @Test
    void postgresEnforcesEmailUniqueness() {
        var user = users.findByEmail("jiwoo@resume.dev");
        assertThatThrownBy(() -> jdbc.update(
            "INSERT INTO users (id, email, nickname, password_hash) VALUES (?, ?, ?, ?)",
            UUID.randomUUID(), user.email(), "중복", "test-hash"))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void postgresRejectsUnsupportedTemplate() {
        var user = users.findByEmail("jiwoo@resume.dev");
        assertThatThrownBy(() -> jdbc.update("""
            INSERT INTO resume (id, user_id, title, template, style, content)
            VALUES (?, ?, '검증', 'unknown', '{}'::jsonb, '[]'::jsonb)
            """, UUID.randomUUID(), user.id()))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
