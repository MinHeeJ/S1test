package com.example.common.persistence;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.SQLException;
import java.util.UUID;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;

class SchemaContractTest extends PostgreSqlSupport {
    @Test
    void generatedUuidJsonbAndByteaRoundTripPreservesPartialContent() throws Exception {
        var json = new ObjectMapper().readTree("""
            [{"type":"basics","hidden":false,"data":{"jobTitle":"","email":"abc@","photoId":null}},
             {"type":"experience","hidden":true,"items":[{"start":"2025.02","end":"2020.01"}]}]
            """);
        UUID user;
        try (var query = connection.prepareStatement("SELECT id FROM users WHERE email = ?")) {
            query.setString(1, "jiwoo@resume.dev");
            try (var result = query.executeQuery()) {
                assertThat(result.next()).isTrue();
                user = new UuidTypeHandler().getNullableResult(result, "id");
            }
        }
        try (var insert = connection.prepareStatement("""
            INSERT INTO resume (user_id, title, template, style, content)
            VALUES (?, ?, ?, ?::jsonb, ?)
            RETURNING id, content, created_at, updated_at
            """)) {
            new UuidTypeHandler().setNonNullParameter(insert, 1, user, JdbcType.OTHER);
            insert.setString(2, "테스트 부분 작성");
            insert.setString(3, "classic");
            insert.setString(4, """
                {"color":"#1F3A5F","font":"pretendard","size":"medium"}
                """);
            new JsonNodeTypeHandler().setNonNullParameter(insert, 5, json, JdbcType.OTHER);
            try (var result = insert.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getObject("id", UUID.class)).isNotNull();
                assertThat(new JsonNodeTypeHandler().getNullableResult(result, "content")).isEqualTo(json);
                assertThat(result.getTimestamp("created_at")).isEqualTo(result.getTimestamp("updated_at"));
            }
        }
        byte[] bytes = new byte[] {0, 1, -1, 42};
        try (var insert = connection.prepareStatement("""
            INSERT INTO photo (user_id, content_type, data)
            VALUES (?, 'image/png', ?)
            RETURNING id, data
            """)) {
            insert.setObject(1, user);
            insert.setBytes(2, bytes);
            try (var result = insert.executeQuery()) {
                assertThat(result.next()).isTrue();
                assertThat(result.getObject("id", UUID.class)).isNotNull();
                assertThat(result.getBytes("data")).isEqualTo(bytes);
            }
        }
    }

    @Test
    void uniqueEmailIsEnforcedByPostgreSql() throws Exception {
        try (var insert = connection.prepareStatement("""
            INSERT INTO users (email, nickname, password_hash)
            VALUES ('jiwoo@resume.dev', '테스트', 'not-a-production-password')
            """)) {
            assertThatThrownBy(insert::executeUpdate).isInstanceOf(SQLException.class)
                .extracting(error -> ((SQLException) error).getSQLState()).isEqualTo("23505");
        }
    }

    @Test
    void nonexistentOwnerIsRejected() throws Exception {
        try (var insert = connection.prepareStatement("""
            INSERT INTO photo (user_id, content_type, data)
            VALUES (?, 'image/png', ?)
            """)) {
            insert.setObject(1, UUID.randomUUID());
            insert.setBytes(2, new byte[] {1});
            assertThatThrownBy(insert::executeUpdate).isInstanceOf(SQLException.class)
                .extracting(error -> ((SQLException) error).getSQLState()).isEqualTo("23503");
        }
    }

    @Test
    void templateConstraintRejectsUnknownValue() throws Exception {
        try (var insert = connection.prepareStatement("""
            INSERT INTO resume (user_id, title, template, style, content)
            SELECT u.id, 'constraint test', 'unknown', '{}'::jsonb, '[]'::jsonb
            FROM users u
            WHERE u.email = 'jiwoo@resume.dev'
            """)) {
            assertThatThrownBy(insert::executeUpdate).isInstanceOf(SQLException.class)
                .extracting(error -> ((SQLException) error).getSQLState()).isEqualTo("23514");
        }
    }
}
