package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.sql.*;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Opt-in real PostgreSQL checks; no memory database can stand in for jsonb/bytea. */
@EnabledIfEnvironmentVariable(named = "TEST_DATABASE_URL", matches = ".+")
class SchemaIntegrationTest {
    private Connection connect() throws SQLException {
        String url = System.getenv("TEST_DATABASE_URL");
        String user = System.getenv("TEST_DATABASE_USER");
        String password = System.getenv("TEST_DATABASE_PASSWORD");
        Flyway.configure().dataSource(url, user, password).load().migrate();
        return DriverManager.getConnection(url, user, password);
    }

    @Test
    void schemaAndBinaryJsonRoundtripEnforceIdentity() throws Exception {
        try (var connection = connect()) {
            connection.setAutoCommit(false);
            try {
                var owner = UUID.randomUUID();
                try (var insert = connection.prepareStatement(
                    "INSERT INTO users (id,email,nickname,password_hash) VALUES (?,?,?,?)")) {
                    insert.setObject(1, owner);
                    insert.setString(2, owner + "@example.test");
                    insert.setString(3, "시험");
                    insert.setString(4, new BCryptPasswordEncoder().encode("fixture-password"));
                    insert.executeUpdate();
                }
                var json = new ObjectMapper().readTree("[{\"type\":\"basics\",\"value\":null}]");
                var resume = UUID.randomUUID();
                try (var insert = connection.prepareStatement("""
                    INSERT INTO resume (id,user_id,title,template,style,content)
                    VALUES (?,?,'시험','classic','{}'::jsonb,?)
                    """)) {
                    insert.setObject(1, resume);
                    insert.setObject(2, owner);
                    new JsonbTypeHandler().setNonNullParameter(insert, 3, json, org.apache.ibatis.type.JdbcType.OTHER);
                    insert.executeUpdate();
                }
                try (var select = connection.prepareStatement("SELECT content FROM resume WHERE id=?")) {
                    select.setObject(1, resume);
                    try (var result = select.executeQuery()) {
                        assertThat(result.next()).isTrue();
                        assertThat(new JsonbTypeHandler().getNullableResult(result, "content")).isEqualTo(json);
                    }
                }
                byte[] bytes = {0, 1, -1, 42};
                var photo = UUID.randomUUID();
                try (var insert = connection.prepareStatement("""
                    INSERT INTO photo (id,user_id,content_type,data)
                    VALUES (?,?,'image/png',?)
                    """)) {
                    insert.setObject(1, photo);
                    insert.setObject(2, owner);
                    insert.setBytes(3, bytes);
                    insert.executeUpdate();
                }
                try (var select = connection.prepareStatement("SELECT data FROM photo WHERE id=?")) {
                    select.setObject(1, photo);
                    try (var result = select.executeQuery()) {
                        assertThat(result.next()).isTrue();
                        assertThat(result.getBytes(1)).isEqualTo(bytes);
                    }
                }
                var savepoint = connection.setSavepoint();
                try (var duplicate = connection.prepareStatement("""
                    INSERT INTO users (id,email,nickname,password_hash)
                    SELECT ?, u.email, u.nickname, u.password_hash FROM users u WHERE u.id=?
                    """)) {
                    duplicate.setObject(1, UUID.randomUUID());
                    duplicate.setObject(2, owner);
                    assertThatThrownBy(duplicate::executeUpdate).isInstanceOf(SQLException.class);
                }
                connection.rollback(savepoint);
                try (var delete = connection.prepareStatement("DELETE FROM users WHERE id=?")) {
                    delete.setObject(1, owner);
                    assertThatThrownBy(delete::executeUpdate).isInstanceOf(SQLException.class);
                }
            } finally {
                connection.rollback();
            }
        }
    }

    @Test
    void seedAccountsAndResumeScopesArePersisted() throws Exception {
        try (var connection = connect(); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("""
                SELECT u.email, u.password_hash
                FROM users u
                WHERE u.email IN ('jiwoo@resume.dev','minjun@resume.dev','seoyeon@resume.dev')
                ORDER BY u.email
                """)) {
                int count = 0;
                while (rows.next()) {
                    assertThat(new BCryptPasswordEncoder().matches("demo1234", rows.getString("password_hash")))
                        .isTrue();
                    count++;
                }
                assertThat(count).isEqualTo(3);
            }
            try (var rows = statement.executeQuery("""
                SELECT r.title, r.template, r.style, r.content
                FROM resume r
                JOIN users u ON u.id = r.user_id
                WHERE u.email='jiwoo@resume.dev' AND r.deleted=FALSE
                ORDER BY r.updated_at DESC, r.id ASC
                """)) {
                int count = 0;
                var mapper = new ObjectMapper();
                while (rows.next()) {
                    var content = mapper.readTree(rows.getString("content"));
                    assertThat(content.get(0).get("type").asText()).isEqualTo("basics");
                    assertThat(content.get(0).get("data").get("photoId").isNull()).isTrue();
                    if (rows.getString("title").equals("백엔드 개발자 이력서")) {
                        assertThat(content.size()).isEqualTo(8);
                        assertThat(rows.getString("template")).isEqualTo("modern");
                        assertThat(mapper.readTree(rows.getString("style")).get("color").asText())
                            .isEqualTo("#1F3A5F");
                    }
                    count++;
                }
                assertThat(count).isEqualTo(3);
            }
            try (var rows = statement.executeQuery("""
                SELECT COUNT(*) FROM resume r JOIN users u ON u.id=r.user_id
                WHERE u.email='seoyeon@resume.dev' AND r.deleted=FALSE
                """)) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isZero();
            }
        }
    }
}
