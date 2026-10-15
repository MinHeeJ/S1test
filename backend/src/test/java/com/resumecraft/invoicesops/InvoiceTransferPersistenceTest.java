package com.resumecraft.invoicesops;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Opt-in selected-engine materialization, defaults, deleted-number reservation and real rollback/retry. */
class InvoiceTransferPersistenceTest {
    @Test
    void realXmlAndFreshTransactionsPreserveSourceAndRecoverFromUniqueConflict() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; DB verification is runner-owned");
        String username = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        Flyway.configure()
                .dataSource(url, username, password)
                .placeholderReplacement(false)
                .load()
                .migrate();
        var dataSource = new UnpooledDataSource("org.postgresql.Driver", url, username, password);
        var config = new Configuration(new Environment("invoice-transfer",
                new SpringManagedTransactionFactory(), dataSource));
        config.setMapUnderscoreToCamelCase(true);
        config.setArgNameBasedConstructorAutoMapping(true);
        try (var input = new ClassPathResource("mappers/InvoiceTransferMapper.xml").getInputStream()) {
            new XMLMapperBuilder(input, config, "mappers/InvoiceTransferMapper.xml", config.getSqlFragments()).parse();
        }
        var sessions = new SqlSessionTemplate(new SqlSessionFactoryBuilder().build(config));
        var mapper = sessions.getMapper(InvoiceTransferMapper.class);
        var transactions = new DataSourceTransactionManager(dataSource);
        var json = new ObjectMapper();
        long owner;
        String email = UUID.randomUUID() + "@invoice.test";
        try (var db = dataSource.getConnection(); var insert = db.prepareStatement("""
                INSERT INTO users (email, nickname, password_hash)
                VALUES (?, '테스트', 'not-a-login-fixture')
                RETURNING id
                """)) {
            insert.setString(1, email);
            try (var result = insert.executeQuery()) {
                assertTrue(result.next());
                owner = result.getLong(1);
            }
        }
        try {
            String content = """
                    {"supplier":{"name":"","bizNo":"","ceo":"","address":"","phone":""},
                     "client":{"name":"","contact":""},"issueDate":"2000-01-01","validUntil":"",
                     "items":[{"id":"kept","name":"","spec":"","qty":1,"unitPrice":550000,"note":""}],
                     "vatMode":"included","notes":"","stampPhotoId":null,"color":"#1F3A5F"}
                    """;
            String year = String.valueOf(LocalDate.now(ZoneId.of("Asia/Seoul")).getYear());
            Long sourceId = mapper.insert(new InvoiceTransferInsert(owner, "quote", "Q-" + year + "-0001",
                    null, "원본", content, 500000L, 50000L, 550000L));
            var source = mapper.find(sourceId, owner);
            assertNotNull(source);
            assertFalse(source.paid());
            assertFalse(source.deleted());
            assertNotNull(source.createdAt());
            assertNotNull(source.updatedAt());
            assertNull(mapper.find(sourceId, owner + 1));
            var actor = UsernamePasswordAuthenticationToken.authenticated(email, null, List.of());
            var service = new InvoiceTransferService(mapper, json, transactions);
            var created = service.convert(actor, sourceId.toString());
            var converted = mapper.find(Long.valueOf(created.id()), owner);
            assertEquals(sourceId, converted.sourceQuoteId());
            assertEquals(550000L, converted.totalAmount());
            assertEquals(50000L, converted.vatAmount());
            assertEquals(json.readTree(content).get("items"), json.readTree(converted.content()).get("items"));
            assertFalse(json.readTree(converted.content()).has("validUntil"));
            assertEquals(source, mapper.find(sourceId, owner));
            var copy = mapper.find(Long.valueOf(service.duplicate(actor, converted.id().toString()).id()), owner);
            assertNull(copy.sourceQuoteId());
            assertFalse(copy.paid());
            assertEquals("invoice", copy.docType());

            // A separately committed writer wins the first proposed number. The failed attempt must roll back.
            var raceMapper = new InvoiceTransferMapper() {
                boolean first = true;
                public Long account(String identity) { return mapper.account(identity); }
                public InvoiceTransferRow find(Long id, Long userId) { return mapper.find(id, userId); }
                public Integer maximum(Long userId, String type, String prefix) {
                    return mapper.maximum(userId, type, prefix);
                }
                public Long insert(InvoiceTransferInsert value) {
                    if (first) {
                        first = false;
                        try (var db = dataSource.getConnection(); var statement = db.prepareStatement("""
                                INSERT INTO invoice (user_id, doc_type, doc_no, title, content,
                                    supply_amount, vat_amount, total_amount, deleted)
                                VALUES (?, 'quote', ?, 'concurrent', CAST(? AS jsonb), 500000, 50000, 550000, TRUE)
                                """)) {
                            statement.setLong(1, owner);
                            statement.setString(2, value.docNo());
                            statement.setString(3, content);
                            statement.executeUpdate();
                        } catch (java.sql.SQLException failure) {
                            throw new IllegalStateException(failure);
                        }
                    }
                    return mapper.insert(value);
                }
            };
            var racingService = new InvoiceTransferService(raceMapper, json, transactions);
            var retried = mapper.find(Long.valueOf(racingService.duplicate(actor, sourceId.toString()).id()), owner);
            assertEquals("Q-" + year + "-0003", retried.docNo());
            assertEquals(source, mapper.find(sourceId, owner));
            assertEquals(3, mapper.maximum(owner, "quote", "Q-" + year + "-"));
        } finally {
            try (var db = DriverManager.getConnection(url, username, password)) {
                try (var delete = db.prepareStatement("DELETE FROM invoice WHERE user_id = ?")) {
                    delete.setLong(1, owner);
                    delete.executeUpdate();
                }
                try (var delete = db.prepareStatement("DELETE FROM users WHERE id = ?")) {
                    delete.setLong(1, owner);
                    delete.executeUpdate();
                }
            }
        }
    }
}
