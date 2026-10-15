package com.resumecraft.invoicesops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(InvoiceTransferController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, InvoiceTransferService.class})
class InvoiceTransferControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean InvoiceTransferMapper mapper;
    @MockBean PlatformTransactionManager transactions;
    final Map<Long, InvoiceTransferRow> rows = new HashMap<>();
    final Map<Long, InvoiceTransferInsert> inserted = new HashMap<>();
    final OffsetDateTime before = OffsetDateTime.parse("2026-01-01T00:00:00Z");
    int collisions;
    long sequence;

    @BeforeEach
    void setup() throws Exception {
        rows.clear();
        inserted.clear();
        sequence = 10;
        collisions = 0;
        when(transactions.getTransaction(any())).thenAnswer(call -> {
            TransactionDefinition definition = call.getArgument(0);
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
            assertEquals(TransactionDefinition.ISOLATION_READ_COMMITTED, definition.getIsolationLevel());
            return new SimpleTransactionStatus();
        });
        when(mapper.account("jiwoo@resume.dev")).thenReturn(1L);
        String content = """
                {"supplier":{"name":"공급자","bizNo":"","ceo":"","address":"","phone":""},
                 "client":{"name":"수신자","contact":""},"issueDate":"2020-01-01","validUntil":"2030-01-01",
                 "items":[{"id":"kept-item-id","name":"품목","spec":"","qty":3,"unitPrice":1000000,"note":""}],
                 "vatMode":"separate","notes":"비고","stampPhotoId":null,"color":"#1F3A5F"}
                """;
        rows.put(1L, source(1L, 1L, "quote", false, null, false, content));
        rows.put(2L, source(2L, 2L, "quote", false, null, false, content));
        rows.put(3L, source(3L, 1L, "quote", true, null, false, content));
        rows.put(4L, source(4L, 1L, "invoice", false, 1L, true, content));
        when(mapper.find(anyLong(), anyLong())).thenAnswer(call -> {
            InvoiceTransferRow row = rows.get(call.getArgument(0));
            return row != null && !row.deleted() && row.userId().equals(call.getArgument(1)) ? row : null;
        });
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenAnswer(call -> inserted.values().stream()
                .filter(row -> row.userId().equals(call.getArgument(0)) && row.docType().equals(call.getArgument(1)))
                .mapToInt(row -> Integer.parseInt(row.docNo().substring(7))).max().orElse(2));
        when(mapper.insert(any())).thenAnswer(call -> {
            if (collisions-- > 0) throw collision("uq_invoice_user_doc_no");
            long id = ++sequence;
            inserted.put(id, call.getArgument(0));
            return id;
        });
    }

    InvoiceTransferRow source(Long id, Long owner, String type, boolean deleted, Long quote,
            boolean paid, String content) {
        return new InvoiceTransferRow(id, owner, type, "Q-2026-0001", quote, "원본", content,
                3000000L, 300000L, 3300000L, paid, deleted, before, before);
    }

    DuplicateKeyException collision(String constraint) {
        return new DuplicateKeyException("private SQL", new SQLException(constraint, "23505"));
    }

    void unchanged(Map<Long, InvoiceTransferRow> original) {
        assertEquals(original, rows);
        assertTrue(inserted.isEmpty());
        verify(mapper, never()).insert(any());
    }

    @Test
    void convertCopiesItemsAndAmountsWithoutTouchingSourceAndCanRepeat() throws Exception {
        Map<Long, InvoiceTransferRow> original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.id").value("11"));
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("12"));
        var copy = inserted.get(11L);
        assertEquals("invoice", copy.docType());
        assertEquals(1L, copy.sourceQuoteId());
        assertEquals("원본", copy.title());
        assertEquals(3300000L, copy.totalAmount());
        assertEquals(3000000L, copy.supplyAmount());
        assertEquals(300000L, copy.vatAmount());
        var content = json.readTree(copy.content());
        var source = json.readTree(rows.get(1L).content());
        for (String field : new String[]{"supplier", "client", "items", "vatMode", "notes", "stampPhotoId", "color"}) {
            assertEquals(source.get(field), content.get(field));
        }
        assertFalse(content.has("validUntil"));
        assertEquals("", content.path("dueDate").asText());
        assertEquals("", content.path("bankAccount").asText());
        assertEquals(LocalDate.now(ZoneId.of("Asia/Seoul")).toString(), content.path("issueDate").asText());
        assertTrue(copy.docNo().matches("I-[0-9]{4}-0003"));
        assertNotEquals(copy.docNo(), inserted.get(12L).docNo());
        assertEquals(1L, inserted.get(12L).sourceQuoteId());
        assertEquals(original, rows);
    }

    @Test
    void duplicateQuoteCopiesContentAndCreatesNextNumber() throws Exception {
        var original = rows.get(1L);
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("11"));
        var copy = inserted.get(11L);
        assertEquals("quote", copy.docType());
        assertTrue(copy.docNo().matches("Q-[0-9]{4}-0003"));
        assertEquals("원본 (사본)", copy.title());
        assertNull(copy.sourceQuoteId());
        var expected = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(original.content());
        expected.put("issueDate", LocalDate.now(ZoneId.of("Asia/Seoul")).toString());
        assertEquals(expected, json.readTree(copy.content()));
        assertEquals(original, rows.get(1L));
    }

    @Test
    void duplicatePaidLinkedInvoiceClearsLinkAndRetainsOriginal() throws Exception {
        var original = rows.get(4L);
        mvc.perform(post("/api/invoices/{id}/duplicate", 4).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("11"));
        assertNull(inserted.get(11L).sourceQuoteId());
        assertEquals("invoice", inserted.get(11L).docType());
        assertEquals(original, rows.get(4L));
        // paid is not an insert parameter; the real mapper/database default is verified by the opt-in SQL test.
    }

    @Test
    void invoiceCannotConvert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 4).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_A_QUOTE"));
        unchanged(original);
    }

    @Test
    void seoulYearChangesBeforeUtcYear() {
        assertEquals(LocalDate.of(2027, 1, 1),
                InvoiceTransferService.seoulDate(Instant.parse("2026-12-31T15:00:00Z")));
        assertEquals(LocalDate.of(2026, 12, 31),
                InvoiceTransferService.seoulDate(Instant.parse("2026-12-31T14:59:59Z")));
    }

    @Test
    void anonymousConvertNeverTouchesPersistence() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 1))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void convertRequiresCsrf() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void convertForeignDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 2).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void convertDeletedDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 3).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void convertMissingDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 999).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void convertRetriesOnlyAfterRollbackAndStartsNewTransaction() throws Exception {
        collisions = 1;
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated());
        var order = inOrder(transactions, mapper);
        order.verify(transactions).getTransaction(any());
        order.verify(mapper).maximum(anyLong(), anyString(), anyString());
        order.verify(mapper).insert(any());
        order.verify(transactions).rollback(any());
        order.verify(transactions).getTransaction(any());
        order.verify(mapper).maximum(anyLong(), anyString(), anyString());
        order.verify(mapper).insert(any());
        order.verify(transactions).commit(any());
        assertEquals(1, inserted.size());
    }

    @Test
    void convertSecondCollisionIsSafeConflictWithoutRows() throws Exception {
        collisions = 2;
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private SQL"))));
        assertEquals(original, rows);
        assertTrue(inserted.isEmpty());
        verify(transactions, times(2)).rollback(any());
    }

    @Test
    void convertNumberExhaustionDoesNotInsert() throws Exception {
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenReturn(9999);
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        unchanged(original);
    }

    @Test
    void convertOtherUniqueViolationIsNotRetriedOrLeaked() throws Exception {
        doThrow(collision("invoice_pkey")).when(mapper).insert(any());
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("invoice_pkey"))));
        verify(mapper, times(1)).insert(any());
        assertTrue(inserted.isEmpty());
    }

    @Test
    void anonymousDuplicateNeverTouchesPersistence() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 1))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void duplicateRequiresCsrf() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void duplicateForeignDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/duplicate", 2).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void duplicateDeletedDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/duplicate", 3).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void duplicateMissingDoesNotInsert() throws Exception {
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/duplicate", 999).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        unchanged(original);
    }

    @Test
    void duplicateRetriesOnlyAfterRollbackAndStartsNewTransaction() throws Exception {
        collisions = 1;
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated());
        var order = inOrder(transactions, mapper);
        order.verify(transactions).getTransaction(any());
        order.verify(mapper).maximum(anyLong(), anyString(), anyString());
        order.verify(mapper).insert(any());
        order.verify(transactions).rollback(any());
        order.verify(transactions).getTransaction(any());
        order.verify(mapper).maximum(anyLong(), anyString(), anyString());
        order.verify(mapper).insert(any());
        order.verify(transactions).commit(any());
        assertEquals(1, inserted.size());
    }

    @Test
    void duplicateSecondCollisionIsSafeConflictWithoutRows() throws Exception {
        collisions = 2;
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private SQL"))));
        assertEquals(original, rows);
        assertTrue(inserted.isEmpty());
        verify(transactions, times(2)).rollback(any());
    }

    @Test
    void duplicateNumberExhaustionDoesNotInsert() throws Exception {
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenReturn(9999);
        var original = Map.copyOf(rows);
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        unchanged(original);
    }

    @Test
    void duplicateOtherUniqueViolationIsNotRetriedOrLeaked() throws Exception {
        doThrow(collision("invoice_pkey")).when(mapper).insert(any());
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("500"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("invoice_pkey"))));
        verify(mapper, times(1)).insert(any());
        assertTrue(inserted.isEmpty());
    }

    @Test
    void durableContractDeclaresBothCommandsAndCreatedResponses() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            Map<?, ?> contract = yaml.load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            for (var pair : Map.of("convert", "createInvoiceFromQuote", "duplicate", "duplicateInvoice").entrySet()) {
                Map<?, ?> path = (Map<?, ?>) paths.get("/api/invoices/{id}/" + pair.getKey());
                Map<?, ?> operation = (Map<?, ?>) path.get("post");
                assertEquals(pair.getValue(), operation.get("operationId"));
                assertTrue(((Map<?, ?>) operation.get("responses")).containsKey("201"));
            }
        }
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString());
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString());
    }
}
