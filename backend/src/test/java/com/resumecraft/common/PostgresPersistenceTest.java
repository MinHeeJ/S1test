package com.resumecraft.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import com.resumecraft.common.persistence.UserMapper;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
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
import org.springframework.core.io.ClassPathResource;

/** Opt-in actual PostgreSQL tests; no Spring context or external connection is needed when skipped. */
@EnabledIfEnvironmentVariable(named = "TEST_DATABASE_URL", matches = ".+")
class PostgresPersistenceTest {
    private static SqlSessionFactory sessions;
    private static UnpooledDataSource database;
    private static String schema;

    @BeforeAll
    static void migrateIsolatedSchema() throws Exception {
        database = new UnpooledDataSource("org.postgresql.Driver", System.getenv("TEST_DATABASE_URL"),
                System.getenv("TEST_DATABASE_USER"), System.getenv("TEST_DATABASE_PASSWORD"));
        schema = "resume_test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(database).schemas(schema).defaultSchema(schema).load().migrate();
        var configuration = new Configuration(new Environment("postgres", new JdbcTransactionFactory(), database));
        for (String name : new String[]{"User", "Resume", "Photo"}) {
            String resource = "mappers/common/" + name + "Mapper.xml";
            try (var input = new ClassPathResource(resource).getInputStream()) {
                new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
            }
        }
        sessions = new SqlSessionFactoryBuilder().build(configuration);
    }

    @AfterAll
    static void removeIsolatedSchema() throws Exception {
        if (database != null && schema != null) {
            try (var connection = database.getConnection(); var statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            }
        }
    }

    @Test
    void migrationsSeedScopesAndIdentityKeysMatchTheApplication() throws Exception {
        try (var session = sessions.openSession()) {
            session.getConnection().setSchema(schema);
            var users = session.getMapper(UserMapper.class);
            var resumes = session.getMapper(ResumeMapper.class);
            var jiwoo = users.findByEmail("jiwoo@resume.dev");
            var minjun = users.findByEmail("minjun@resume.dev");
            var seoyeon = users.findByEmail("seoyeon@resume.dev");
            assertThat(resumes.listOwned(jiwoo.id())).hasSize(3);
            assertThat(resumes.listOwned(minjun.id())).hasSize(1);
            assertThat(resumes.listOwned(seoyeon.id())).isEmpty();
            assertThat(resumes.findOwned(resumes.listOwned(jiwoo.id()).get(0).id(), minjun.id())).isNull();
            assertThatThrownBy(() -> users.insert(jiwoo.email(), "중복", jiwoo.passwordHash()))
                    .isInstanceOf(org.apache.ibatis.exceptions.PersistenceException.class);
            session.rollback();
        }
    }

    @Test
    void actualMapperRoundTripsJsonbUuidByteaAndOwnerGuardedWritesAcrossConnections() throws Exception {
        var json = new ObjectMapper();
        var style = json.readTree("""
                {"color":"#1F3A5F","font":"pretendard","size":"medium"}
                """);
        var content = json.readTree("""
                [{"type":"basics","hidden":false,"data":{"email":"abc@","jobTitle":"","photoId":null}},
                 {"type":"experience","hidden":true,"items":[{"start":"wrong","current":true}]}]
                """);
        UUID photoId = UUID.randomUUID();
        byte[] original = new byte[]{0, 1, 2, -1, 0};
        Long userId;
        Long resumeId;
        try (var session = sessions.openSession()) {
            session.getConnection().setSchema(schema);
            userId = session.getMapper(UserMapper.class).findByEmail("jiwoo@resume.dev").id();
            resumeId = session.getMapper(ResumeMapper.class).insert(userId, "왕복 시험", "classic", style, content);
            assertThat(session.getMapper(PhotoMapper.class).insert(photoId, userId, "image/png", original)).isOne();
            session.commit();
        }
        try (var session = sessions.openSession()) {
            session.getConnection().setSchema(schema);
            var resumes = session.getMapper(ResumeMapper.class);
            var row = resumes.findOwned(resumeId, userId);
            assertThat(row.content()).isEqualTo(content);
            assertThat(row.style()).isEqualTo(style);
            assertThat(row.createdAt()).isNotNull();
            var photos = session.getMapper(PhotoMapper.class);
            assertThat(photos.findOwned(photoId, userId).data()).containsExactly(original);
            assertThat(photos.findOwned(photoId, Long.MAX_VALUE)).isNull();
            assertThat(resumes.updateOwned(resumeId, Long.MAX_VALUE, "modern", style, content)).isZero();
            assertThat(resumes.updateOwned(resumeId, userId, "modern", style, content)).isOne();
            assertThat(resumes.findOwned(resumeId, userId).title()).isEqualTo("왕복 시험");
            assertThat(resumes.renameOwned(resumeId, userId, "새 제목")).isOne();
            assertThat(resumes.deleteOwned(resumeId, userId)).isOne();
            assertThat(resumes.findOwned(resumeId, userId)).isNull();
            assertThat(resumes.deleteOwned(resumeId, userId)).isZero();
            assertThat(photos.findOwned(photoId, userId)).isNotNull();
            session.rollback();
        }
    }
}
