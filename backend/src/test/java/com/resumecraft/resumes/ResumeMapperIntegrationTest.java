package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.JsonbTypeHandler;
import com.resumecraft.common.UuidTypeHandler;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;

/** Opt-in real PostgreSQL mapper materialization; absent test DB skips before creating any connection. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ResumeMapperIntegrationTest {
    static PGSimpleDataSource dataSource;
    static SqlSessionFactory factory;
    static String schema;
    static final UUID OWNER = UUID.fromString("10000000-0000-4000-8000-000000000001");

    @BeforeAll
    static void setup() throws Exception {
        schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        dataSource = new PGSimpleDataSource();
        dataSource.setURL(System.getenv("TEST_DB_URL"));
        dataSource.setUser(System.getenv().getOrDefault("TEST_DB_USER", "resumecraft"));
        dataSource.setPassword(System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
        Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
            .locations("classpath:db/migration").load().migrate();
        dataSource.setCurrentSchema(schema);
        var config = new Configuration(new Environment("test", new JdbcTransactionFactory(), dataSource));
        config.getTypeHandlerRegistry().register(UuidTypeHandler.class);
        config.getTypeHandlerRegistry().register(JsonbTypeHandler.class);
        try (var input = new ClassPathResource("mappers/ResumeMapper.xml").getInputStream()) {
            new XMLMapperBuilder(input, config, "mappers/ResumeMapper.xml", config.getSqlFragments()).parse();
        }
        factory = new SqlSessionFactoryBuilder().build(config);
    }

    @AfterAll
    static void cleanup() throws Exception {
        if (dataSource == null || schema == null) return;
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    @Test
    void softDeleteKeepsPhotoWithoutCascadeAndPhotoCreatedAtIsDatabaseGenerated() throws Exception {
        UUID photoId = UUID.randomUUID();
        UUID resumeId = UUID.randomUUID();
        byte[] originalBytes = new byte[]{1, 2, 3, 4};
        try (var session = factory.openSession()) {
            var connection = session.getConnection();
            try (var insert = connection.prepareStatement("""
                    INSERT INTO photo (id, user_id, content_type, data)
                    VALUES (?, ?, ?, ?)
                    """)) {
                insert.setObject(1, photoId);
                insert.setObject(2, OWNER);
                insert.setString(3, "image/png");
                insert.setBytes(4, originalBytes);
                assertThat(insert.executeUpdate()).isEqualTo(1);
            }
            var mapper = session.getMapper(ResumeMapper.class);
            var source = mapper.list(OWNER).get(0);
            var content = source.content().deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) content.get(0).path("data"))
                .put("photoId", photoId.toString());
            var write = new ResumeWrite("사진 보존 검증", source.template(), source.style(), content);
            assertThat(mapper.insert(resumeId, OWNER, write)).isEqualTo(1);
            assertThat(mapper.ownsPhoto(photoId, OWNER)).isTrue();
            assertThat(mapper.delete(resumeId, OWNER)).isEqualTo(1);
            assertThat(mapper.find(resumeId, OWNER)).isNull();
            try (var query = connection.prepareStatement("""
                    SELECT deleted, content
                    FROM resume
                    WHERE id = ?
                    """)) {
                query.setObject(1, resumeId);
                try (var row = query.executeQuery()) {
                    assertThat(row.next()).isTrue();
                    assertThat(row.getBoolean("deleted")).isTrue();
                    assertThat(new ObjectMapper().readTree(row.getString("content"))).isEqualTo(content);
                    assertThat(row.next()).isFalse();
                }
            }
            try (var query = connection.prepareStatement("""
                    SELECT user_id, content_type, data, created_at
                    FROM photo
                    WHERE id = ?
                    """)) {
                query.setObject(1, photoId);
                try (var row = query.executeQuery()) {
                    assertThat(row.next()).isTrue();
                    assertThat(row.getObject("user_id", UUID.class)).isEqualTo(OWNER);
                    assertThat(row.getString("content_type")).isEqualTo("image/png");
                    assertThat(row.getBytes("data")).isEqualTo(originalBytes);
                    assertThat(row.getTimestamp("created_at")).isNotNull();
                    assertThat(row.next()).isFalse();
                }
            }
            session.rollback();
        }
    }

    @Test
    void realJsonbUuidAndTimestampMappingAndAllScopedCommandsRoundTrip() throws Exception {
        var json = new ObjectMapper();
        UUID created;
        try (var session = factory.openSession()) {
            var mapper = session.getMapper(ResumeMapper.class);
            var rows = mapper.list(OWNER);
            assertThat(rows).hasSize(3);
            assertThat(mapper.email(OWNER)).isEqualTo("jiwoo@resume.dev");
            var original = rows.get(0);
            assertThat(original.content().isArray()).isTrue();
            assertThat(original.updatedAt()).isNotNull();
            assertThat(mapper.find(original.id(), UUID.randomUUID())).isNull();
            var write = new ResumeWrite("원문  ", original.template(), original.style(), original.content());
            created = UUID.randomUUID();
            assertThat(mapper.insert(created, OWNER, write)).isEqualTo(1);
            assertThat(mapper.find(created, OWNER).content()).isEqualTo(write.content());
            assertThat(mapper.rename(created, OWNER, "이름 변경")).isEqualTo(1);
            assertThat(mapper.find(created, OWNER).title()).isEqualTo("이름 변경");
            assertThat(mapper.find(created, OWNER).updatedAt()).isAfterOrEqualTo(original.updatedAt());
            var changed = original.content().deepCopy();
            ((com.fasterxml.jackson.databind.node.ObjectNode) changed.get(0).path("data")).put("name", "한글 원문");
            assertThat(mapper.save(created, OWNER,
                new ResumeWrite("저장", original.template(), original.style(), changed)))
                .isEqualTo(1);
            assertThat(mapper.find(created, OWNER).content()).isEqualTo(changed);
            UUID copy = mapper.duplicate(created, OWNER);
            assertThat(copy).isNotEqualTo(created);
            assertThat(mapper.find(copy, OWNER).content()).isEqualTo(changed);
            assertThat(mapper.find(copy, OWNER).title()).isEqualTo("저장 (사본)");
            assertThat(mapper.delete(created, OWNER)).isEqualTo(1);
            assertThat(mapper.find(created, OWNER)).isNull();
            assertThat(mapper.save(created, OWNER, write)).isZero();
            assertThat(mapper.rename(created, OWNER, "불가")).isZero();
            assertThat(mapper.delete(created, OWNER)).isZero();
            assertThat(mapper.duplicate(created, OWNER)).isNull();
            assertThat(mapper.ownsPhoto(UUID.randomUUID(), OWNER)).isFalse();
            session.rollback();
        }
        try (var session = factory.openSession()) {
            assertThat(session.getMapper(ResumeMapper.class).find(created, OWNER)).isNull();
            assertThat(session.getMapper(ResumeMapper.class).list(OWNER)).hasSize(3);
        }
    }
}
