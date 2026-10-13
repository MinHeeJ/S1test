package com.resumecraft.photos;

import java.sql.DriverManager;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Opt-in real PostgreSQL execution of the feature XML, including primitive record materialization. */
class PhotoPersistenceTest {
    @Test
    void xmlMapperRoundTripsOriginalBytesAndScopesReadWithoutChangingResume() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; no database in unit-test container");
        String username = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        Flyway.configure().dataSource(url, username, password).load().migrate();
        long owner;
        long foreign;
        String before;
        try (var db = DriverManager.getConnection(url, username, password);
                var query = db.createStatement()) {
            try (var result = query.executeQuery("SELECT id FROM users WHERE email = 'jiwoo@resume.dev'")) {
                assertTrue(result.next());
                owner = result.getLong(1);
            }
            try (var result = query.executeQuery("SELECT id FROM users WHERE email = 'minjun@resume.dev'")) {
                assertTrue(result.next());
                foreign = result.getLong(1);
            }
            try (var result = query.executeQuery(
                    "SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM resume r")) {
                assertTrue(result.next());
                before = result.getString(1);
            }
        }
        var source = new UnpooledDataSource("org.postgresql.Driver", url, username, password);
        var configuration = new Configuration(new Environment("photos", new JdbcTransactionFactory(), source));
        try (var input = new ClassPathResource("mappers/PhotoMapper.xml").getInputStream()) {
            new XMLMapperBuilder(input, configuration, "mappers/PhotoMapper.xml",
                    configuration.getSqlFragments()).parse();
        }
        var factory = new SqlSessionFactoryBuilder().build(configuration);
        byte[] original = {0, -1, 1, 0, 10};
        String id = UUID.randomUUID().toString();
        try (var session = factory.openSession(false)) {
            try {
                PhotoMapper mapper = session.getMapper(PhotoMapper.class);
                assertEquals(1, mapper.insert(new PhotoRow(id, owner, "image/png", original)));
                PhotoRow row = mapper.findOwned(id, owner);
                assertEquals(id, row.id());
                assertEquals(owner, row.userId());
                assertEquals("image/png", row.contentType());
                assertArrayEquals(original, row.data());
                assertNull(mapper.findOwned(id, foreign));
                assertNull(mapper.findOwned(UUID.randomUUID().toString(), owner));
                try (var query = session.getConnection().createStatement();
                        var result = query.executeQuery(
                                "SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM resume r")) {
                    assertTrue(result.next());
                    assertEquals(before, result.getString(1));
                }
                try (var query = session.getConnection().prepareStatement(
                        "SELECT created_at FROM photo WHERE id = CAST(? AS UUID)")) {
                    query.setString(1, id);
                    try (var result = query.executeQuery()) {
                        assertTrue(result.next());
                        assertNotNull(result.getTimestamp(1));
                    }
                }
            } finally {
                session.rollback();
            }
        }
        try (var session = factory.openSession()) {
            assertNull(session.getMapper(PhotoMapper.class).findOwned(id, owner));
        }
    }
}
