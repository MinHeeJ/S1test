package com.resumecraft.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Selected-engine schema checks; the service-free runner leaves these opt-in tests skipped. */
class InvoiceSchemaPersistenceTest {
    private final ObjectMapper json = new ObjectMapper();
    private Connection db;

    @BeforeEach
    void connect() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent; runner SQL check owns database verification");
        String username = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        Flyway.configure().dataSource(url, username, password).load().migrate();
        db = DriverManager.getConnection(url, username, password);
        db.setAutoCommit(false);
    }

    @AfterEach
    void rollback() throws Exception {
        if (db != null) {
            try {
                db.rollback();
            } finally {
                db.close();
            }
        }
    }

    @Test
    void fivePhotoFreeSeedsUseExistingOwnersAndConsistentIntegerAmounts() throws Exception {
        try (var statement = db.createStatement(); var rows = statement.executeQuery("""
                SELECT i.*, u.email, u.nickname
                FROM invoice i
                JOIN users u ON u.id = i.user_id
                ORDER BY u.email, i.doc_no
                """)) {
            int jiwoo = 0;
            int minjun = 0;
            while (rows.next()) {
                var content = json.readTree(rows.getString("content"));
                assertTrue(content.get("stampPhotoId").isNull());
                assertEquals("2026-01-01", content.get("issueDate").asText());
                assertEquals(rows.getString("nickname"), content.path("supplier").path("name").asText());
                assertEquals("#1F3A5F", content.get("color").asText());
                assertFalse(rows.getBoolean("deleted"));
                assertNotNull(rows.getObject("created_at", java.time.OffsetDateTime.class));
                assertNotNull(rows.getObject("updated_at", java.time.OffsetDateTime.class));
                long sum = 0;
                var ids = new HashSet<String>();
                for (var item : content.get("items")) {
                    assertTrue(ids.add(item.get("id").asText()));
                    UUID.fromString(item.get("id").asText());
                    sum += item.get("qty").asLong() * item.get("unitPrice").asLong();
                }
                long vat = content.get("vatMode").asText().equals("included") ? sum / 11 : sum / 10;
                long supply = content.get("vatMode").asText().equals("included") ? sum - vat : sum;
                assertEquals(supply, rows.getLong("supply_amount"));
                assertEquals(vat, rows.getLong("vat_amount"));
                assertEquals(supply + vat, rows.getLong("total_amount"));
                if (rows.getString("email").equals("jiwoo@resume.dev")) {
                    jiwoo++;
                } else {
                    assertEquals("minjun@resume.dev", rows.getString("email"));
                    assertEquals("새 견적서", rows.getString("title"));
                    assertEquals(1, content.get("items").size());
                    assertEquals("", content.get("items").get(0).get("name").asText());
                    assertEquals(0, sum);
                    minjun++;
                }
            }
            assertEquals(4, jiwoo);
            assertEquals(1, minjun);
        }
    }

    @Test
    void completedQuoteAndConvertedInvoicePreserveItemsAndSourceIdentity() throws Exception {
        var quote = seed("jiwoo@resume.dev", "Q-2026-0001");
        var invoice = seed("jiwoo@resume.dev", "I-2026-0001");
        assertEquals("홈페이지 리뉴얼 견적", quote.get("title").asText());
        assertEquals(3000000, quote.get("supply_amount").asLong());
        assertEquals(300000, quote.get("vat_amount").asLong());
        assertEquals(3300000, quote.get("total_amount").asLong());
        var content = quote.get("content");
        assertEquals("separate", content.get("vatMode").asText());
        assertEquals(3, content.get("items").size());
        assertEquals("기획", content.get("items").get(0).get("name").asText());
        assertEquals("디자인", content.get("items").get(1).get("name").asText());
        assertEquals("퍼블리싱", content.get("items").get(2).get("name").asText());
        assertEquals(10, content.get("items").get(2).get("qty").asInt());
        assertEquals(quote.get("id"), invoice.get("source_quote_id"));
        assertEquals(quote.get("title"), invoice.get("title"));
        assertEquals(content.get("items"), invoice.get("content").get("items"));
        assertEquals(content.get("supplier"), invoice.get("content").get("supplier"));
        assertEquals(content.get("client"), invoice.get("content").get("client"));
        assertEquals("", invoice.get("content").get("dueDate").asText());
        assertEquals("", invoice.get("content").get("bankAccount").asText());
        assertFalse(invoice.get("content").has("validUntil"));
        assertFalse(invoice.get("paid").asBoolean());
    }

    @Test
    void draftQuoteIsMissingOnlyClientNameAndPaidSeedUsesIncludedVat() throws Exception {
        var draft = seed("jiwoo@resume.dev", "Q-2026-0002");
        assertEquals("작성 중인 견적", draft.get("title").asText());
        var content = draft.get("content");
        assertEquals("", content.path("client").path("name").asText());
        assertFalse(content.path("supplier").path("name").asText().isBlank());
        assertFalse(content.get("issueDate").asText().isBlank());
        assertFalse(content.get("items").isEmpty());
        for (var item : content.get("items")) {
            assertFalse(item.get("name").asText().isBlank());
            assertTrue(item.get("qty").asInt() >= 1);
        }
        var paid = seed("jiwoo@resume.dev", "I-2026-0002");
        assertEquals("9월 유지보수", paid.get("title").asText());
        assertEquals("included", paid.get("content").get("vatMode").asText());
        assertEquals(500000, paid.get("supply_amount").asLong());
        assertEquals(50000, paid.get("vat_amount").asLong());
        assertEquals(550000, paid.get("total_amount").asLong());
        assertTrue(paid.get("paid").asBoolean());
        assertTrue(paid.get("source_quote_id").isNull());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "doc_type = 'other'",
        "paid = TRUE",
        "supply_amount = -1",
        "vat_amount = -1",
        "total_amount = -1"
    })
    void invalidTypeQuotePaidAndNegativeAmountsCannotChangeRow(String assignment) throws Exception {
        var before = seed("jiwoo@resume.dev", "Q-2026-0001");
        var savepoint = db.setSavepoint();
        try (var update = db.prepareStatement("UPDATE invoice SET " + assignment + " WHERE id = ?")) {
            update.setLong(1, before.get("id").asLong());
            var error = assertThrows(SQLException.class, update::executeUpdate);
            assertEquals("23514", error.getSQLState());
        }
        db.rollback(savepoint);
        assertEquals(before, seed("jiwoo@resume.dev", "Q-2026-0001"));
    }

    @Test
    void deletedNumbersRemainUniqueWhileDifferentOwnersMayShareNumbers() throws Exception {
        var original = seed("jiwoo@resume.dev", "Q-2026-0002");
        var foreign = seed("minjun@resume.dev", "Q-2026-0001");
        assertNotEquals(original.get("user_id"), foreign.get("user_id"));
        try (var update = db.prepareStatement("UPDATE invoice SET deleted = TRUE WHERE id = ?")) {
            update.setLong(1, original.get("id").asLong());
            assertEquals(1, update.executeUpdate());
        }
        var deleted = seed("jiwoo@resume.dev", "Q-2026-0002");
        assertEquals(original.get("content"), deleted.get("content"));
        assertEquals(original.get("updated_at"), deleted.get("updated_at"));
        assertTrue(deleted.get("deleted").asBoolean());
        var savepoint = db.setSavepoint();
        try (var insert = db.prepareStatement("""
                INSERT INTO invoice (
                    user_id, doc_type, doc_no, title, content, supply_amount, vat_amount, total_amount
                )
                SELECT user_id, doc_type, doc_no, title, content, supply_amount, vat_amount, total_amount
                FROM invoice
                WHERE id = ?
                """)) {
            insert.setLong(1, original.get("id").asLong());
            var error = assertThrows(SQLException.class, insert::executeUpdate);
            assertEquals("23505", error.getSQLState());
            assertTrue(error.getMessage().contains("invoice_user_id_doc_no_key"));
        }
        db.rollback(savepoint);
        assertEquals(deleted, seed("jiwoo@resume.dev", "Q-2026-0002"));
        try (var select = db.prepareStatement("""
                SELECT MAX(RIGHT(doc_no, 4)::integer) + 1
                FROM invoice
                WHERE user_id = ?
                    AND doc_type = 'quote'
                    AND doc_no LIKE 'Q-2026-%'
                """)) {
            select.setLong(1, original.get("user_id").asLong());
            try (var result = select.executeQuery()) {
                assertTrue(result.next());
                assertEquals(3, result.getInt(1));
            }
        }
    }

    @Test
    void sourceQuoteSoftDeletePreservesConvertedInvoiceButPhysicalDeleteIsRestricted() throws Exception {
        var quote = seed("jiwoo@resume.dev", "Q-2026-0001");
        var invoice = seed("jiwoo@resume.dev", "I-2026-0001");
        try (var update = db.prepareStatement("UPDATE invoice SET deleted = TRUE WHERE id = ?")) {
            update.setLong(1, quote.get("id").asLong());
            assertEquals(1, update.executeUpdate());
        }
        assertEquals(invoice, seed("jiwoo@resume.dev", "I-2026-0001"));
        var savepoint = db.setSavepoint();
        try (var delete = db.prepareStatement("DELETE FROM invoice WHERE id = ?")) {
            delete.setLong(1, quote.get("id").asLong());
            assertEquals("23503", assertThrows(SQLException.class, delete::executeUpdate).getSQLState());
        }
        db.rollback(savepoint);
        assertEquals(invoice, seed("jiwoo@resume.dev", "I-2026-0001"));
    }

    @Test
    void invoiceAllowsPaidBothDirectionsAndBigintJsonbRoundTripWithoutLocking() throws Exception {
        var original = seed("jiwoo@resume.dev", "I-2026-0002");
        long itemSum = Math.multiplyExact(50L, Math.multiplyExact(99999L, 999999999L));
        long vat = itemSum / 10;
        var content = original.get("content").deepCopy();
        var object = (com.fasterxml.jackson.databind.node.ObjectNode) content;
        object.put("vatMode", "separate");
        UUID stamp = UUID.randomUUID();
        object.put("stampPhotoId", stamp.toString());
        var items = object.putArray("items");
        for (int i = 0; i < 50; i++) {
            items.addObject().put("id", UUID.randomUUID().toString()).put("name", "")
                    .put("spec", "").put("qty", 99999).put("unitPrice", 999999999).put("note", "");
        }
        try (var insert = db.prepareStatement("""
                INSERT INTO photo (id, user_id, content_type, data)
                VALUES (?, ?, 'image/png', ?)
                """)) {
            insert.setObject(1, stamp);
            insert.setLong(2, original.get("user_id").asLong());
            insert.setBytes(3, new byte[] {0, 1, -1});
            assertEquals(1, insert.executeUpdate());
        }
        try (var update = db.prepareStatement("""
                UPDATE invoice
                SET content = ?::jsonb,
                    supply_amount = ?,
                    vat_amount = ?,
                    total_amount = ?
                WHERE id = ?
                """)) {
            update.setString(1, content.toString());
            update.setLong(2, itemSum);
            update.setLong(3, vat);
            update.setLong(4, Math.addExact(itemSum, vat));
            update.setLong(5, original.get("id").asLong());
            assertEquals(1, update.executeUpdate());
        }
        var changed = seed("jiwoo@resume.dev", "I-2026-0002");
        assertTrue(changed.get("paid").asBoolean());
        assertEquals(itemSum + vat, changed.get("total_amount").asLong());
        assertEquals(content, changed.get("content"));
        for (boolean paid : new boolean[] {false, true}) {
            try (var update = db.prepareStatement("UPDATE invoice SET paid = ? WHERE id = ?")) {
                update.setBoolean(1, paid);
                update.setLong(2, original.get("id").asLong());
                assertEquals(1, update.executeUpdate());
            }
            var readback = seed("jiwoo@resume.dev", "I-2026-0002");
            assertEquals(paid, readback.get("paid").asBoolean());
            assertEquals(content, readback.get("content"));
        }
    }

    @Test
    void unknownOwnerAndSourceCannotBeStored() throws Exception {
        var original = seed("jiwoo@resume.dev", "I-2026-0001");
        for (String column : new String[] {"user_id", "source_quote_id"}) {
            var savepoint = db.setSavepoint();
            try (var update = db.prepareStatement("UPDATE invoice SET " + column + " = ? WHERE id = ?")) {
                update.setLong(1, Long.MAX_VALUE);
                update.setLong(2, original.get("id").asLong());
                assertEquals("23503", assertThrows(SQLException.class, update::executeUpdate).getSQLState());
            }
            db.rollback(savepoint);
            assertEquals(original, seed("jiwoo@resume.dev", "I-2026-0001"));
        }
    }

    private JsonNode seed(String email, String number) throws Exception {
        try (var select = db.prepareStatement("""
                SELECT row_to_json(i)::text
                FROM invoice i
                JOIN users u ON u.id = i.user_id
                WHERE u.email = ?
                    AND i.doc_no = ?
                """)) {
            select.setString(1, email);
            select.setString(2, number);
            try (var result = select.executeQuery()) {
                assertTrue(result.next(), "Expected invoice seed " + number);
                JsonNode row = json.readTree(result.getString(1));
                assertFalse(result.next());
                return row;
            }
        }
    }
}
