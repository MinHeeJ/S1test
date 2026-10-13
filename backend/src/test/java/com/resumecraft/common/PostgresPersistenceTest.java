package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Opt-in selected-engine checks; absent connection settings skip before any database access. */
class PostgresPersistenceTest {
    @Test
    void migrationSeedConstraintsAndJsonbByteaRoundTrip() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; runner SQL check owns database verification");
        String username = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        Flyway.configure().dataSource(url, username, password).load().migrate();
        try (var db = DriverManager.getConnection(url, username, password)) {
            db.setAutoCommit(false);
            try {
                try (var query = db.createStatement(); var users = query.executeQuery(
                        "SELECT email, nickname, password_hash FROM users WHERE email LIKE '%@resume.dev'")) {
                    int count = 0;
                    while (users.next()) {
                        assertTrue(new BCryptPasswordEncoder().matches("demo1234", users.getString("password_hash")));
                        count++;
                    }
                    assertEquals(3, count);
                }
                long owner;
                try (var query = db.createStatement(); var result = query.executeQuery(
                        "SELECT id FROM users WHERE email = 'jiwoo@resume.dev'")) {
                    assertTrue(result.next());
                    owner = result.getLong(1);
                }
                try (var query = db.createStatement(); var result = query.executeQuery(
                        "SELECT title, content, template, style FROM resume WHERE user_id = " + owner
                                + " AND deleted = FALSE ORDER BY updated_at DESC, id DESC")) {
                    int count = 0;
                    var json = new ObjectMapper();
                    while (result.next()) {
                        var content = json.readTree(result.getString("content"));
                        assertEquals("basics", content.get(0).get("type").asText());
                        assertTrue(content.get(0).get("data").get("photoId").isNull());
                        if (result.getString("title").equals("백엔드 개발자 이력서")) {
                            assertEquals(8, content.size());
                            assertEquals("modern", result.getString("template"));
                            assertEquals("#1F3A5F", json.readTree(result.getString("style")).get("color").asText());
                        }
                        if (result.getString("title").equals("작성 중인 이력서")) {
                            assertEquals("", content.get(0).get("data").get("jobTitle").asText());
                            assertTrue(content.get(1).get("hidden").asBoolean());
                        }
                        count++;
                    }
                    assertEquals(3, count);
                }
                byte[] bytes = {0, 1, -1, 10, 0};
                UUID id = UUID.randomUUID();
                try (var insert = db.prepareStatement(
                        "INSERT INTO photo (id, user_id, content_type, data) VALUES (?, ?, 'image/png', ?)")) {
                    insert.setObject(1, id);
                    insert.setLong(2, owner);
                    insert.setBytes(3, bytes);
                    assertEquals(1, insert.executeUpdate());
                }
                try (var select = db.prepareStatement("SELECT data FROM photo WHERE id = ? AND user_id = ?")) {
                    select.setObject(1, id);
                    select.setLong(2, owner);
                    try (var result = select.executeQuery()) {
                        assertTrue(result.next());
                        assertArrayEquals(bytes, result.getBytes(1));
                    }
                }
                try (var update = db.prepareStatement(
                        "UPDATE resume SET content = ?::jsonb WHERE user_id = ? AND title = '작성 중인 이력서'")) {
                    update.setString(1, "[{\"type\":\"basics\",\"hidden\":false,\"data\":{\"email\":\"abc@\"}}]");
                    update.setLong(2, owner);
                    assertEquals(1, update.executeUpdate());
                }
                try (var select = db.prepareStatement(
                        "SELECT content->0->'data'->>'email' FROM resume"
                                + " WHERE user_id = ? AND title = '작성 중인 이력서'")) {
                    select.setLong(1, owner);
                    try (var result = select.executeQuery()) {
                        assertTrue(result.next());
                        assertEquals("abc@", result.getString(1));
                    }
                }
                var savepoint = db.setSavepoint();
                try (var duplicate = db.prepareStatement(
                        "INSERT INTO users (email, nickname, password_hash) VALUES ('jiwoo@resume.dev', '중복', 'hash')")) {
                    var error = assertThrows(java.sql.SQLException.class, duplicate::executeUpdate);
                    assertEquals("23505", error.getSQLState());
                }
                db.rollback(savepoint);
            } finally {
                db.rollback();
            }
        }
    }
}
