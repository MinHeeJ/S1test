package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

// Real PostgreSQL only. The gate is evaluated without creating an application context.
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class SchemaContractTest {
    @Test
    void migrationsAndNativeTypesRoundTrip() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        String user = System.getenv("TEST_DB_USER");
        String password = System.getenv("TEST_DB_PASSWORD");
        String schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        var flyway = Flyway.configure().dataSource(url, user, password).schemas(schema)
                .locations("classpath:db/migration").cleanDisabled(false).load();
        try {
            flyway.migrate();
            try (Connection db = DriverManager.getConnection(url, user, password)) {
                db.setSchema(schema);
                try (var query = db.createStatement(); var rows = query.executeQuery("""
                        SELECT data_type
                        FROM information_schema.columns
                        WHERE table_schema = current_schema() AND table_name = 'resume' AND column_name = 'content'
                        """)) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("jsonb");
                }
                UUID id = UUID.randomUUID();
                var json = new ObjectMapper().readTree("""
                        [{"type":"basics","hidden":false,"data":{"email":"abc@","jobTitle":"","photoId":null}},
                         {"type":"experience","hidden":true,"items":[{"start":"bad","current":true}]}]
                        """);
                try (var insert = db.prepareStatement("""
                        INSERT INTO resume (id, user_id, title, template, style, content)
                        SELECT ?, u.id, 'round-trip', 'classic', '{}'::jsonb, ?
                        FROM users u
                        WHERE u.email = 'jiwoo@resume.dev'
                        """)) {
                    new UuidTypeHandler().setNonNullParameter(insert, 1, id, null);
                    new JsonNodeTypeHandler().setNonNullParameter(insert, 2, json, null);
                    assertThat(insert.executeUpdate()).isEqualTo(1);
                }
                try (var select = db.prepareStatement("SELECT id, content FROM resume WHERE id = ?")) {
                    select.setObject(1, id);
                    try (var rows = select.executeQuery()) {
                        assertThat(rows.next()).isTrue();
                        assertThat(new UuidTypeHandler().getNullableResult(rows, "id")).isEqualTo(id);
                        assertThat(new JsonNodeTypeHandler().getNullableResult(rows, "content")).isEqualTo(json);
                    }
                }
                byte[] bytes = new byte[]{0, 1, -1, 42};
                try (var insert = db.prepareStatement("""
                        INSERT INTO photo (id, user_id, content_type, data)
                        SELECT ?, u.id, 'image/png', ?
                        FROM users u
                        WHERE u.email = 'jiwoo@resume.dev'
                        RETURNING data
                        """)) {
                    insert.setObject(1, UUID.randomUUID());
                    insert.setBytes(2, bytes);
                    try (var rows = insert.executeQuery()) {
                        assertThat(rows.next()).isTrue();
                        assertThat(rows.getBytes(1)).isEqualTo(bytes);
                    }
                }
                assertThatThrownBy(() -> db.createStatement().executeUpdate("""
                        INSERT INTO users (id, email, nickname, password_hash)
                        SELECT 'c8ca7096-032b-4e5a-a3eb-7427f2d48a50', email, nickname, password_hash
                        FROM users WHERE email = 'jiwoo@resume.dev'
                        """)).isInstanceOf(SQLException.class);
            }
        } finally {
            flyway.clean();
        }
    }
}
