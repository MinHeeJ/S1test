package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class DemoSeedIntegrationTest extends PostgresTestDatabase {
    @Test
    void threeDeclaredAccountsHaveUsableBcryptAndNoPhotos() throws Exception {
        try (var query = database.createStatement();
                var rows = query.executeQuery("SELECT email, password_hash FROM users ORDER BY email")) {
            int count = 0;
            var encoder = new BCryptPasswordEncoder();
            while (rows.next()) {
                assertThat(encoder.matches("demo1234", rows.getString("password_hash"))).isTrue();
                count++;
            }
            assertThat(count).isEqualTo(3);
        }
        try (var query = database.createStatement(); var rows = query.executeQuery("SELECT count(*) FROM photo")) {
            rows.next();
            assertThat(rows.getInt(1)).isZero();
        }
    }

    @Test
    void jiwooFixturesPreserveStructureStyleHiddenAndNullPhoto() throws Exception {
        var json = new ObjectMapper();
        try (var query = database.createStatement(); var rows = query.executeQuery("""
                SELECT title, template, style, content
                FROM resume
                WHERE user_id = '10000000-0000-4000-8000-000000000001'
                ORDER BY id ASC
                """)) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString("template")).isEqualTo("modern");
            assertThat(json.readTree(rows.getString("style")).get("color").asText()).isEqualTo("#1F3A5F");
            var full = json.readTree(rows.getString("content"));
            assertThat(full.size()).isEqualTo(8);
            assertThat(full.get(0).get("data").get("photoId").isNull()).isTrue();
            assertThat(rows.next()).isTrue();
            var entry = json.readTree(rows.getString("content"));
            assertThat(entry.get(2).get("items").size()).isEqualTo(1);
            assertThat(entry.get(3).get("data").get("tags").size()).isEqualTo(5);
            assertThat(entry.get(4).get("items").size()).isEqualTo(2);
            assertThat(rows.next()).isTrue();
            var draft = json.readTree(rows.getString("content"));
            assertThat(draft.get(0).get("data").get("jobTitle").asText()).isEmpty();
            assertThat(draft.get(2).get("hidden").asBoolean()).isTrue();
            assertThat(draft.get(2).get("items").get(0).get("company").asText()).isEmpty();
            assertThat(rows.next()).isFalse();
        }
    }

    @Test
    void seoyeonHasOnlyDeletedResumeAndMinjunOneActiveResume() throws Exception {
        try (var query = database.createStatement(); var rows = query.executeQuery("""
                SELECT u.email, r.deleted
                FROM users u
                JOIN resume r ON r.user_id = u.id
                WHERE u.email IN ('minjun@resume.dev', 'seoyeon@resume.dev')
                ORDER BY u.email
                """)) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString("email")).isEqualTo("minjun@resume.dev");
            assertThat(rows.getBoolean("deleted")).isFalse();
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString("email")).isEqualTo("seoyeon@resume.dev");
            assertThat(rows.getBoolean("deleted")).isTrue();
            assertThat(rows.next()).isFalse();
        }
    }
}
