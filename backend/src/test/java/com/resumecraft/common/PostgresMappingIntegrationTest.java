package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.SQLException;
import java.util.UUID;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class PostgresMappingIntegrationTest extends PostgresTestDatabase {
    @Test
    void jsonbUuidAndByteaSurviveFreshRead() throws Exception {
        var json = new ObjectMapper().readTree("""
            {"array":["한글",null],"hidden":true}
            """);
        var handler = new JsonbTypeHandler();
        var idHandler = new UuidTypeHandler();
        UUID photoId = UUID.randomUUID();
        UUID owner = UUID.fromString("10000000-0000-4000-8000-000000000001");
        byte[] bytes = new byte[]{(byte) 0xff, 0, 1, 2, 127};
        try (var insert = database.prepareStatement("""
                INSERT INTO photo (id, user_id, content_type, data)
                VALUES (?, ?, 'image/png', ?)
                """)) {
            idHandler.setNonNullParameter(insert, 1, photoId, JdbcType.OTHER);
            idHandler.setNonNullParameter(insert, 2, owner, JdbcType.OTHER);
            insert.setBytes(3, bytes);
            assertThat(insert.executeUpdate()).isEqualTo(1);
        }
        try (var query = database.prepareStatement("SELECT ? AS body, id, data FROM photo WHERE id = ?")) {
            handler.setNonNullParameter(query, 1, json, JdbcType.OTHER);
            idHandler.setNonNullParameter(query, 2, photoId, JdbcType.OTHER);
            try (var row = query.executeQuery()) {
                assertThat(row.next()).isTrue();
                assertThat(handler.getNullableResult(row, "body")).isEqualTo(json);
                assertThat(idHandler.getNullableResult(row, "id")).isEqualTo(photoId);
                assertThat(row.getBytes("data")).isEqualTo(bytes);
            }
        }
    }

    @Test
    void duplicateEmailViolatesActualUniqueConstraint() throws Exception {
        try (var insert = database.prepareStatement("""
                INSERT INTO users (email, nickname, password_hash)
                VALUES ('jiwoo@resume.dev', '중복', 'not-a-login-hash')
                """)) {
            assertThatThrownBy(insert::executeUpdate).isInstanceOf(SQLException.class)
                .satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23505"));
        }
    }

    @Test
    void foreignOwnerAndDeletedRowsAreExcludedByOwnerPredicate() throws Exception {
        try (var query = database.prepareStatement("""
                SELECT id
                FROM resume
                WHERE user_id = ?
                    AND deleted = false
                ORDER BY updated_at DESC, id ASC
                """)) {
            query.setObject(1, UUID.fromString("10000000-0000-4000-8000-000000000001"));
            try (var rows = query.executeQuery()) {
                int count = 0;
                while (rows.next()) {
                    count++;
                }
                assertThat(count).isEqualTo(3);
            }
        }
    }
}
