package com.resumecraft.invoicesops;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
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

/** Opt-in PostgreSQL mapper verification; absence of runner database settings is an explicit skip. */
class InvoiceCopyPersistenceTest {
    @Test
    void xmlUsesOwnerLiveScopeAndDeletedNumberHistoryAndReturnsGeneratedKey() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; selected-engine verification deferred");
        String username = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        Flyway.configure().dataSource(url, username, password).load().migrate();
        var datasource = new UnpooledDataSource("org.postgresql.Driver", url, username, password);
        var configuration = new Configuration(
                new Environment("invoice-copy", new JdbcTransactionFactory(), datasource));
        try (var input = new ClassPathResource("mappers/InvoiceCopyMapper.xml").getInputStream()) {
            new XMLMapperBuilder(input, configuration, "mappers/InvoiceCopyMapper.xml",
                    configuration.getSqlFragments()).parse();
        }
        var factory = new SqlSessionFactoryBuilder().build(configuration);
        try (var session = factory.openSession(false)) {
            try {
                long owner;
                long id;
                long foreign;
                String snapshot;
                try (var query = session.getConnection().createStatement()) {
                    try (var result = query.executeQuery("SELECT id FROM users WHERE email = 'jiwoo@resume.dev'")) {
                        assertTrue(result.next());
                        owner = result.getLong(1);
                    }
                    try (var result = query.executeQuery("SELECT id FROM users WHERE email = 'minjun@resume.dev'")) {
                        assertTrue(result.next());
                        foreign = result.getLong(1);
                    }
                    try (var result = query.executeQuery("""
                            SELECT i.id, to_jsonb(i)::text AS snapshot
                            FROM invoice i
                            WHERE i.doc_no = 'Q-2026-0001'
                                AND i.user_id = %d
                            """.formatted(owner))) {
                        assertTrue(result.next());
                        id = result.getLong("id");
                        snapshot = result.getString("snapshot");
                    }
                }
                InvoiceCopyMapper mapper = session.getMapper(InvoiceCopyMapper.class);
                InvoiceCopyRow row = mapper.find(id, owner);
                assertNotNull(row);
                assertEquals("quote", row.docType());
                assertNull(mapper.find(id, foreign));
                assertNull(mapper.find(Long.MAX_VALUE, owner));
                String prefix = "I-" + LocalDate.now(ZoneId.of("Asia/Seoul")).getYear() + "-";
                int maximum = mapper.maximum(owner, "invoice", prefix);
                assertTrue(maximum < 9998);
                Long copied = mapper.insert(owner, "invoice", prefix + "9998", id, row.title(), row.content(),
                        3000000L, 300000L, 3300000L);
                assertNotEquals(id, copied.longValue());
                assertEquals(row.content(), mapper.find(copied, owner).content());
                try (var query = session.getConnection().prepareStatement(
                        "UPDATE invoice SET deleted = TRUE WHERE id = ?")) {
                    query.setLong(1, copied);
                    assertEquals(1, query.executeUpdate());
                }
                session.clearCache();
                assertNull(mapper.find(copied, owner));
                assertEquals(9998, mapper.maximum(owner, "invoice", prefix));
                assertNotEquals(9998, mapper.maximum(foreign, "invoice", prefix));
                try (var query = session.getConnection().prepareStatement("""
                        SELECT to_jsonb(i)::text
                        FROM invoice i
                        WHERE i.id = ?
                        """)) {
                    query.setLong(1, id);
                    try (var result = query.executeQuery()) {
                        assertTrue(result.next());
                        assertEquals(snapshot, result.getString(1));
                    }
                }
                var json = new ObjectMapper();
                try (var query = session.getConnection().prepareStatement("""
                        SELECT to_jsonb(i)::text
                        FROM invoice i
                        WHERE i.id = ?
                        """)) {
                    query.setLong(1, copied);
                    try (var result = query.executeQuery()) {
                        assertTrue(result.next());
                        var stored = json.readTree(result.getString(1));
                        assertEquals(id, stored.get("source_quote_id").asLong());
                        assertFalse(stored.get("paid").asBoolean());
                        assertEquals(3300000L, stored.get("total_amount").asLong());
                        assertNotNull(stored.get("created_at"));
                    }
                }
            } finally {
                session.rollback();
            }
        }
    }
}
