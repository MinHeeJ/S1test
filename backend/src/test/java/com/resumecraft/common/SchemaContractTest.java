package com.resumecraft.common;

import java.time.Instant;
import java.util.UUID;
import java.sql.SQLException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.persistence.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import static org.assertj.core.api.Assertions.*;

class SchemaContractTest extends PostgresTestSupport {
    @Test
    void schemaReferenceCanRunAgainWithoutCreatingExtraTables() throws Exception {
        try (var connection = connection(); var statement = connection.createStatement()) {
            var ddl = new ClassPathResource("schema.sql")
                    .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
            statement.execute(ddl);
            var rows = statement.executeQuery("SELECT count(*) FROM information_schema.tables "
                    + "WHERE table_schema = '" + schema + "' AND table_name IN ('users', 'resume', 'photo')");
            rows.next();
            assertThat(rows.getInt(1)).isEqualTo(3);
        }
    }

    @Test
    void emailUniqueAndTemplateCheckRejectInvalidRows() throws Exception {
        try (var connection = connection(); var statement = connection.createStatement()) {
            assertThatThrownBy(() -> statement.execute("INSERT INTO users (id, email, nickname, password_hash) "
                    + "SELECT '" + UUID.randomUUID() + "', email, nickname, password_hash FROM users LIMIT 1"))
                    .isInstanceOf(SQLException.class).satisfies(error ->
                            assertThat(((SQLException) error).getSQLState()).isEqualTo("23505"));
            assertThatThrownBy(() -> statement.execute("UPDATE resume SET template = 'unknown'"))
                    .isInstanceOf(SQLException.class).satisfies(error ->
                            assertThat(((SQLException) error).getSQLState()).isEqualTo("23514"));
        }
    }

    @Test
    void xmlMappersRoundTripUuidJsonbByteaAndKeepOwnerDeleteBoundary() throws Exception {
        var json = new ObjectMapper();
        var now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        UUID id = UUID.randomUUID();
        UUID photoId = UUID.randomUUID();
        UUID userId;
        var style = json.readTree("""
                {"color":"#1F3A5F","font":"pretendard","size":"medium"}
                """);
        var content = json.readTree("""
                [{"type":"basics","hidden":false,"data":{"name":"","jobTitle":"","email":"abc@","photoId":null}},
                 {"type":"experience","hidden":true,"items":[{"id":"entry","company":"","start":"wrong"}]}]
                """);
        byte[] bytes = {0, 1, 2, 127, -1};
        try (var session = sessions.openSession(true)) {
            userId = session.getMapper(UserMapper.class).findByEmail("jiwoo@resume.dev").id();
            var resumes = session.getMapper(ResumeMapper.class);
            assertThat(resumes.insert(new ResumeRow(id, userId, "왕복 시험", "modern", style, content, false, now, now)))
                    .isEqualTo(1);
            var photos = session.getMapper(PhotoMapper.class);
            assertThat(photos.insert(new PhotoRow(photoId, userId, "image/png", bytes, now))).isEqualTo(1);
            assertThat(resumes.findOwnedActive(id, UUID.randomUUID())).isNull();
            assertThat(resumes.renameOwnedActive(id, UUID.randomUUID(), "타인 변경")).isZero();
            assertThat(photos.findOwned(photoId, UUID.randomUUID())).isNull();
        }
        // A new DB session proves readback is not an in-memory mapper fixture.
        try (var session = sessions.openSession(true)) {
            var resumes = session.getMapper(ResumeMapper.class);
            var stored = resumes.findOwnedActive(id, userId);
            assertThat(stored.content()).isEqualTo(content);
            assertThat(stored.style()).isEqualTo(style);
            assertThat(stored.updatedAt()).isEqualTo(now);
            assertThat(session.getMapper(PhotoMapper.class).findOwned(photoId, userId).data()).isEqualTo(bytes);
            assertThat(resumes.deleteOwnedActive(id, userId)).isEqualTo(1);
            assertThat(resumes.findOwnedActive(id, userId)).isNull();
            assertThat(resumes.deleteOwnedActive(id, userId)).isZero();
            assertThat(resumes.renameOwnedActive(id, userId, "삭제 후 변경")).isZero();
            assertThat(session.getMapper(PhotoMapper.class).findOwned(photoId, userId)).isNotNull();
        }
    }
}
