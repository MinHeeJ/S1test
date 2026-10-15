package com.resumecraft.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Selected-engine schema and seed checks; connection absence skips before Flyway or JDBC access. */
class InvoiceMigrationTest {
    private Connection db;
    private final ObjectMapper json = new ObjectMapper();

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
    void fiveImageFreeSeedsHaveExpectedOwnersAndRecomputedIntegerAmounts() throws Exception {
        try (var query = db.createStatement(); var rows = query.executeQuery("""
                SELECT i.*, u.email
                FROM invoice i
                JOIN users u ON u.id = i.user_id
                ORDER BY u.email, i.doc_no
                """)) {
            int count = 0;
            Set<String> identities = new HashSet<>();
            while (rows.next()) {
                count++;
                String identity = rows.getString("email") + "/" + rows.getString("doc_no");
                identities.add(identity);
                JsonNode content = json.readTree(rows.getString("content"));
                assertTrue(content.get("stampPhotoId").isNull());
                assertEquals("#1F3A5F", content.get("color").asText());
                assertEquals(2026, LocalDate.parse(content.get("issueDate").asText()).getYear());
                assertFalse(content.get("supplier").get("name").asText().isBlank());
                assertFalse(rows.getBoolean("deleted"));
                assertNotNull(rows.getObject("created_at", java.time.OffsetDateTime.class));
                assertNotNull(rows.getObject("updated_at", java.time.OffsetDateTime.class));
                long sum = 0;
                Set<String> itemIds = new HashSet<>();
                assertFalse(content.get("items").isEmpty());
                for (JsonNode item : content.get("items")) {
                    assertTrue(itemIds.add(UUID.fromString(item.get("id").asText()).toString()));
                    assertFalse(item.get("name").asText().isBlank());
                    assertTrue(item.get("qty").asLong() > 0);
                    sum += item.get("qty").asLong() * item.get("unitPrice").asLong();
                }
                boolean included = content.get("vatMode").asText().equals("included");
                long vat = included ? sum / 11 : sum / 10;
                assertEquals(included ? sum - vat : sum, rows.getLong("supply_amount"));
                assertEquals(vat, rows.getLong("vat_amount"));
                assertEquals(included ? sum : sum + vat, rows.getLong("total_amount"));
                if (identity.equals("jiwoo@resume.dev/Q-2026-0002")) {
                    assertEquals("작성 중인 견적", rows.getString("title"));
                    assertEquals("", content.get("client").get("name").asText());
                } else {
                    assertFalse(content.get("client").get("name").asText().isBlank());
                }
                assertEquals(identity.equals("jiwoo@resume.dev/I-2026-0002"), rows.getBoolean("paid"));
            }
            assertEquals(5, count);
            assertEquals(Set.of(
                    "jiwoo@resume.dev/Q-2026-0001",
                    "jiwoo@resume.dev/Q-2026-0002",
                    "jiwoo@resume.dev/I-2026-0001",
                    "jiwoo@resume.dev/I-2026-0002",
                    "minjun@resume.dev/Q-2026-0001"
            ), identities);
        }
    }

    @Test
    void convertedSeedRetainsQuoteIdentityItemsAndAmounts() throws Exception {
        try (var query = db.createStatement(); var row = query.executeQuery("""
                SELECT q.title, q.content::text AS original_content, c.content::text AS converted_content,
                    q.supply_amount, q.vat_amount, q.total_amount,
                    c.supply_amount AS converted_supply, c.vat_amount AS converted_vat,
                    c.total_amount AS converted_total, c.paid
                FROM invoice c
                JOIN invoice q ON q.id = c.source_quote_id
                JOIN users u ON u.id = c.user_id
                WHERE u.email = 'jiwoo@resume.dev'
                    AND c.doc_no = 'I-2026-0001'
                    AND q.doc_no = 'Q-2026-0001'
                """)) {
            assertTrue(row.next());
            assertEquals("홈페이지 리뉴얼 견적", row.getString("title"));
            JsonNode original = json.readTree(row.getString("original_content"));
            JsonNode converted = json.readTree(row.getString("converted_content"));
            for (String field : Set.of("supplier", "client", "items", "vatMode", "notes", "stampPhotoId", "color")) {
                assertEquals(original.get(field), converted.get(field));
            }
            assertFalse(converted.has("validUntil"));
            assertEquals("", converted.get("dueDate").asText());
            assertEquals("", converted.get("bankAccount").asText());
            assertEquals(3000000, row.getLong("supply_amount"));
            assertEquals(300000, row.getLong("vat_amount"));
            assertEquals(3300000, row.getLong("total_amount"));
            assertEquals(row.getLong("supply_amount"), row.getLong("converted_supply"));
            assertEquals(row.getLong("vat_amount"), row.getLong("converted_vat"));
            assertEquals(row.getLong("total_amount"), row.getLong("converted_total"));
            assertFalse(row.getBoolean("paid"));
            assertFalse(row.next());
        }
    }

    @Test
    void numberUniquenessIncludesDeletedRowsButSeparatesOwnersTypesAndYears() throws Exception {
        long owner = owner();
        update("UPDATE invoice SET deleted = TRUE WHERE user_id = ? AND doc_no = 'Q-2026-0002'", owner);
        try (var query = db.prepareStatement("""
                SELECT MAX(RIGHT(i.doc_no, 4)::integer) + 1
                FROM invoice i
                WHERE i.user_id = ?
                    AND i.doc_type = 'quote'
                    AND i.doc_no LIKE 'Q-2026-%'
                """)) {
            query.setLong(1, owner);
            try (var row = query.executeQuery()) {
                assertTrue(row.next());
                assertEquals(3, row.getInt(1));
            }
        }
        rejects("23505", """
                INSERT INTO invoice (user_id, doc_type, doc_no, title, content,
                    supply_amount, vat_amount, total_amount)
                VALUES (?, 'quote', 'Q-2026-0002', '중복', '{}', 0, 0, 0)
                """, owner);
        update("""
                INSERT INTO invoice (user_id, doc_type, doc_no, title, content,
                    supply_amount, vat_amount, total_amount)
                VALUES (?, 'quote', 'Q-2027-0001', '새 연도', '{}', 0, 0, 0)
                """, owner);
        // The two owners' Q-2026-0001 and quote/invoice 0001 already coexist in the seed.
        try (var query = db.createStatement(); var row = query.executeQuery("""
                SELECT COUNT(*)
                FROM invoice i
                WHERE i.doc_no IN ('Q-2026-0001', 'I-2026-0001')
                """)) {
            assertTrue(row.next());
            assertEquals(3, row.getInt(1));
        }
    }

    @Test
    void quoteCannotBePaidButInvoiceCanBeEditedAndToggledBothWays() throws Exception {
        long owner = owner();
        rejects("23514", "UPDATE invoice SET paid = TRUE WHERE user_id = ? AND doc_type = 'quote'", owner);
        update("""
                UPDATE invoice
                SET title = '입금 후 편집', content = jsonb_set(content, '{notes}', '"편집"'::jsonb)
                WHERE user_id = ? AND doc_no = 'I-2026-0002'
                """, owner);
        try (var query = db.prepareStatement("SELECT paid FROM invoice WHERE user_id = ? AND doc_no = 'I-2026-0002'")) {
            query.setLong(1, owner);
            try (var row = query.executeQuery()) {
                assertTrue(row.next());
                assertTrue(row.getBoolean(1));
            }
        }
        update("UPDATE invoice SET paid = FALSE WHERE user_id = ? AND doc_no = 'I-2026-0002'", owner);
        update("UPDATE invoice SET paid = TRUE WHERE user_id = ? AND doc_no = 'I-2026-0002'", owner);
    }

    @Test
    void sourceQuoteSoftDeletePreservesConvertedRowAndPhysicalDeleteIsRestricted() throws Exception {
        long owner = owner();
        update("UPDATE invoice SET deleted = TRUE WHERE user_id = ? AND doc_no = 'Q-2026-0001'", owner);
        try (var query = db.prepareStatement("""
                SELECT c.deleted, q.deleted
                FROM invoice c
                JOIN invoice q ON q.id = c.source_quote_id
                WHERE c.user_id = ? AND c.doc_no = 'I-2026-0001'
                """)) {
            query.setLong(1, owner);
            try (var row = query.executeQuery()) {
                assertTrue(row.next());
                assertFalse(row.getBoolean(1));
                assertTrue(row.getBoolean(2));
            }
        }
        rejects("23503", "DELETE FROM invoice WHERE user_id = ? AND doc_no = 'Q-2026-0001'", owner);
        rejects("23503", "DELETE FROM users WHERE id = ?", owner);
        rejects("23503", "UPDATE invoice SET source_quote_id = -1 WHERE user_id = ?", owner);
        rejects("23503", "UPDATE invoice SET user_id = -1 WHERE user_id = ?", owner);
    }

    @Test
    void bigintAmountsRoundTripAndInvalidAmountsTypesAndNullsAreRejected() throws Exception {
        long owner = owner();
        long sum = 50L * 99999L * 999999999L;
        long vat = sum / 10;
        try (var query = db.prepareStatement("""
                UPDATE invoice
                SET supply_amount = ?, vat_amount = ?, total_amount = ?
                WHERE user_id = ? AND doc_no = 'I-2026-0002'
                RETURNING supply_amount, vat_amount, total_amount
                """)) {
            query.setLong(1, sum);
            query.setLong(2, vat);
            query.setLong(3, sum + vat);
            query.setLong(4, owner);
            try (var row = query.executeQuery()) {
                assertTrue(row.next());
                assertEquals(sum, row.getLong(1));
                assertEquals(vat, row.getLong(2));
                assertEquals(sum + vat, row.getLong(3));
            }
        }
        rejects("23514", "UPDATE invoice SET supply_amount = -1 WHERE user_id = ?", owner);
        rejects("23514", "UPDATE invoice SET vat_amount = -1 WHERE user_id = ?", owner);
        rejects("23514", "UPDATE invoice SET total_amount = -1 WHERE user_id = ?", owner);
        rejects("23514", "UPDATE invoice SET doc_type = 'receipt' WHERE user_id = ?", owner);
        rejects("23514", "UPDATE invoice SET content = '[]'::jsonb WHERE user_id = ?", owner);
        rejects("23502", "UPDATE invoice SET content = NULL WHERE user_id = ?", owner);
    }

    private long owner() throws SQLException {
        try (var query = db.createStatement(); var row = query.executeQuery(
                "SELECT id FROM users WHERE email = 'jiwoo@resume.dev'")) {
            assertTrue(row.next());
            return row.getLong(1);
        }
    }

    private void update(String sql, long owner) throws SQLException {
        try (var query = db.prepareStatement(sql)) {
            query.setLong(1, owner);
            assertTrue(query.executeUpdate() > 0);
        }
    }

    private void rejects(String state, String sql, long owner) throws SQLException {
        var savepoint = db.setSavepoint();
        try (var query = db.prepareStatement(sql)) {
            query.setLong(1, owner);
            SQLException error = assertThrows(SQLException.class, query::executeUpdate);
            assertEquals(state, error.getSQLState());
        } finally {
            db.rollback(savepoint);
            db.releaseSavepoint(savepoint);
        }
    }
}
