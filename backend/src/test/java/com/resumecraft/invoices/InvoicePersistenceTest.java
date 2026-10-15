package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Year;
import java.time.ZoneId;
import java.util.UUID;
import org.apache.ibatis.session.SqlSessionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Opt-in PostgreSQL mapper materialization and transactional readback; no in-memory SQL substitute. */
class InvoicePersistenceTest {
    @Test
    void realMapperRoundTripPhotoRetentionAndDeletedNumberAllocation() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; selected-engine check is opt-in");
        String user = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        var dataSource = new DriverManagerDataSource(url, user, password);
        Flyway.configure().dataSource(dataSource).load().migrate();
        var bean = new SqlSessionFactoryBean();
        bean.setDataSource(dataSource);
        bean.setMapperLocations(new ClassPathResource("mappers/InvoiceMapper.xml"));
        var config = new org.apache.ibatis.session.Configuration();
        config.setMapUnderscoreToCamelCase(true);
        config.setArgNameBasedConstructorAutoMapping(true);
        bean.setConfiguration(config);
        SqlSessionFactory factory = bean.getObject();
        assertNotNull(factory);
        try (var session = factory.openSession(false)) {
            try {
                InvoiceMapper mapper = session.getMapper(InvoiceMapper.class);
                Long owner = mapper.account("jiwoo@resume.dev").id();
                Long other = mapper.account("minjun@resume.dev").id();
                String prefix = "Q-" + Year.now(ZoneId.of("Asia/Seoul")) + "-";
                int next = mapper.maxNumber(owner, "quote", prefix) + 1;
                var json = new ObjectMapper();
                var c = InvoiceDefaults.content(json, "quote", null);
                var item = (com.fasterxml.jackson.databind.node.ObjectNode) c.path("items").get(0);
                item.put("qty", 99999).put("unitPrice", 999999999);
                long totalBefore = mapper.count(owner, "quote");
                Long id = mapper.insert(owner, "quote", prefix + String.format("%04d", next), null,
                        "실제 DB 검증", c.toString(), InvoiceCalculator.calculate(c));
                InvoiceRow row = mapper.find(id, owner);
                assertNotNull(row);
                assertEquals(id, row.id());
                assertNull(row.sourceQuoteId());
                assertEquals(owner, row.userId());
                assertEquals(InvoiceCalculator.calculate(c).total(), row.totalAmount());
                assertNotNull(row.createdAt());
                assertNotNull(row.updatedAt());
                assertNull(mapper.find(id, other));
                assertEquals(totalBefore + 1, mapper.count(owner, "quote"));
                assertTrue(mapper.list(owner, "quote", 0).stream().allMatch(r ->
                        r.userId().equals(owner) && r.docType().equals("quote") && !r.deleted()));
                UUID photo = UUID.randomUUID();
                byte[] bytes = new byte[]{0, 1, 2, -1};
                try (var insert = session.getConnection().prepareStatement(
                        "INSERT INTO photo (id, user_id, content_type, data) VALUES (?, ?, 'image/png', ?)")) {
                    insert.setObject(1, photo);
                    insert.setLong(2, owner);
                    insert.setBytes(3, bytes);
                    insert.executeUpdate();
                }
                c.put("stampPhotoId", photo.toString());
                assertTrue(mapper.ownsPhoto(photo.toString(), owner));
                assertFalse(mapper.ownsPhoto(photo.toString(), other));
                var write = new InvoiceWrite("직인 연결", c, false);
                assertEquals(1, mapper.save(id, owner, write, c.toString(), InvoiceCalculator.calculate(c)));
                InvoiceRow saved = mapper.find(id, owner);
                assertEquals(photo.toString(), json.readTree(saved.content()).path("stampPhotoId").asText());
                assertEquals(row.docNo(), saved.docNo());
                assertEquals(row.createdAt(), saved.createdAt());
                assertEquals(1, mapper.delete(id, owner));
                assertNull(mapper.find(id, owner));
                assertEquals(next, mapper.maxNumber(owner, "quote", prefix));
                assertEquals(totalBefore, mapper.count(owner, "quote"));
                try (var select = session.getConnection().prepareStatement("SELECT data FROM photo WHERE id = ?")) {
                    select.setObject(1, photo);
                    try (var result = select.executeQuery()) {
                        assertTrue(result.next());
                        assertArrayEquals(bytes, result.getBytes(1));
                    }
                }
            } finally {
                session.rollback();
            }
        }
    }
}
