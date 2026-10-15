package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import com.resumecraft.resumes.ResumeAccount;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.ZoneId;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(InvoiceController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, InvoiceService.class,
        InvoiceStructureValidator.class, InvoiceNumberService.class})
class InvoiceControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean InvoiceMapper mapper;
    @MockBean PlatformTransactionManager transactions;
    final Map<Long, InvoiceRow> rows = new HashMap<>();
    final OffsetDateTime before = OffsetDateTime.parse("2026-01-01T00:00:00Z");
    long sequence;

    @BeforeEach
    void setup() {
        sequence = 100;
        when(transactions.getTransaction(any())).thenAnswer(c -> new SimpleTransactionStatus());
        when(mapper.account(anyString())).thenReturn(new ResumeAccount(1L, "jiwoo@resume.dev", "지우"));
        rows.clear();
        for (long id = 1; id <= 3; id++) {
            var c = InvoiceDefaults.content(json, id == 3 ? "invoice" : "quote", null);
            rows.put(id, new InvoiceRow(id, id == 2 ? 2L : 1L, id == 3 ? "invoice" : "quote",
                    "Q-2026-000" + id, null, "원본", c.toString(), 0L, 0L, 0L,
                    false, false, before, before));
        }
        when(mapper.find(anyLong(), anyLong())).thenAnswer(c -> {
            InvoiceRow r = rows.get(c.getArgument(0));
            return r != null && !r.deleted() && r.userId().equals(c.getArgument(1)) ? r : null;
        });
        when(mapper.list(anyLong(), nullable(String.class), anyLong())).thenAnswer(c ->
                filtered(c.getArgument(0), c.getArgument(1)).stream().skip(c.getArgument(2)).limit(20).toList());
        when(mapper.count(anyLong(), nullable(String.class))).thenAnswer(c ->
                (long) filtered(c.getArgument(0), c.getArgument(1)).size());
        when(mapper.maxNumber(anyLong(), anyString(), anyString())).thenReturn(2);
        when(mapper.insert(anyLong(), anyString(), anyString(), isNull(), anyString(), anyString(), any()))
                .thenAnswer(c -> {
                    Long id = ++sequence;
                    InvoiceCalculator.Amounts a = c.getArgument(6);
                    rows.put(id, new InvoiceRow(id, c.getArgument(0), c.getArgument(1), c.getArgument(2),
                            null, c.getArgument(4), c.getArgument(5), a.supply(), a.vat(), a.total(),
                            false, false, before, before));
                    return id;
                });
        when(mapper.save(anyLong(), anyLong(), any(), anyString(), any())).thenAnswer(c -> {
            InvoiceRow old = rows.get(c.getArgument(0));
            InvoiceWrite w = c.getArgument(2);
            InvoiceCalculator.Amounts a = c.getArgument(4);
            rows.put(old.id(), new InvoiceRow(old.id(), old.userId(), old.docType(), old.docNo(),
                    old.sourceQuoteId(), w.title(), c.getArgument(3), a.supply(), a.vat(), a.total(),
                    w.paid(), false, old.createdAt(), before.plusDays(1)));
            return 1;
        });
        when(mapper.delete(anyLong(), anyLong())).thenAnswer(c -> {
            InvoiceRow r = rows.get(c.getArgument(0));
            rows.put(r.id(), new InvoiceRow(r.id(), r.userId(), r.docType(), r.docNo(), r.sourceQuoteId(),
                    r.title(), r.content(), r.supplyAmount(), r.vatAmount(), r.totalAmount(), r.paid(), true,
                    r.createdAt(), r.updatedAt()));
            return 1;
        });
    }

    List<InvoiceRow> filtered(Long owner, String type) {
        return rows.values().stream().filter(r -> r.userId().equals(owner) && !r.deleted()
                && (type == null || type.equals(r.docType())))
                .sorted(Comparator.comparing(InvoiceRow::updatedAt).thenComparing(InvoiceRow::id).reversed()).toList();
    }

    ObjectNode write(long id) throws Exception {
        ObjectNode w = json.createObjectNode().put("title", "변경").put("paid", false);
        w.set("content", json.readTree(rows.get(id).content()));
        return w;
    }

    void save(long id, ObjectNode w, int status) throws Exception {
        mvc.perform(put("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(w.toString())).andExpect(status().is(status));
    }

    @Test
    void createReturnsKeyDefaultsAndNextNumber() throws Exception {
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("101"));
        mvc.perform(get("/api/invoices/{id}", 101).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.doc_no").value("Q-" + Year.now(ZoneId.of("Asia/Seoul")) + "-0003"))
                .andExpect(jsonPath("$.data.content.items.length()").value(1))
                .andExpect(jsonPath("$.data.content.supplier.name").value(""))
                .andExpect(jsonPath("$.data.content.vatMode").value("separate"))
                .andExpect(jsonPath("$.data.paid").value(false));
    }

    @Test
    void copiesOnlyLatestSupplierAndStamp() throws Exception {
        var c = json.readTree(rows.get(3L).content());
        ((ObjectNode) c.path("supplier")).put("name", "공급자");
        ((ObjectNode) c).put("stampPhotoId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        InvoiceRow old = rows.get(3L);
        InvoiceRow latest = new InvoiceRow(old.id(), old.userId(), old.docType(), old.docNo(), null,
                old.title(), c.toString(), 0L, 0L, 0L, false, false, before, before);
        when(mapper.latest(1L)).thenReturn(latest);
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isCreated());
        assertEquals("공급자", json.readTree(rows.get(101L).content()).path("supplier").path("name").asText());
        assertEquals(c.path("stampPhotoId"), json.readTree(rows.get(101L).content()).path("stampPhotoId"));
        assertEquals(old, rows.get(3L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"docType\":\"unknown\"}",
            "{\"docType\":\"quote\",\"doc_no\":\"Q-2026-0001\"}"})
    void createRejectsMissingInvalidAndReadonly(String body) throws Exception {
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value(body.contains("doc_no") ? "doc_no" : "docType"));
        assertEquals(3, rows.size());
    }

    @Test
    void listUsesSameFilterAndTotalAndReadDoesNotWrite() throws Exception {
        mvc.perform(get("/api/invoices").param("type", "invoice").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].id").value("3"));
        verify(mapper, never()).save(anyLong(), anyLong(), any(), anyString(), any());
    }

    @Test
    void paginationHasTwentyThenOneWithoutOverlap() throws Exception {
        InvoiceRow r = rows.get(1L);
        rows.remove(3L);
        for (long id = 4; id < 24; id++) rows.put(id, new InvoiceRow(id, 1L, r.docType(), r.docNo(), null,
                r.title(), r.content(), 0L, 0L, 0L, false, false, before, before));
        mvc.perform(get("/api/invoices").param("page", "1").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.items.length()").value(20)).andExpect(jsonPath("$.data.total").value(21));
        mvc.perform(get("/api/invoices").param("page", "2").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value("1"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"type", "page", "size"})
    void rejectsBadQuery(String field) throws Exception {
        mvc.perform(get("/api/invoices").param(field, "0").with(user("jiwoo@resume.dev")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field));
    }

    @Test
    void recalculatesAndAllowsDraftAndPaidFollowup() throws Exception {
        ObjectNode w = write(3);
        ObjectNode item = (ObjectNode) w.path("content").path("items").get(0);
        item.put("qty", 10).put("unitPrice", 300000);
        w.put("paid", true);
        save(3, w, 204);
        mvc.perform(get("/api/invoices/{id}", 3).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.supply_amount").value(3000000))
                .andExpect(jsonPath("$.data.vat_amount").value(300000))
                .andExpect(jsonPath("$.data.total_amount").value(3300000))
                .andExpect(jsonPath("$.data.content.client.name").value(""))
                .andExpect(jsonPath("$.data.paid").value(true));
        item.put("unitPrice", 5);
        save(3, w, 204);
        assertTrue(rows.get(3L).paid());
        w.put("paid", false);
        save(3, w, 204);
        assertFalse(rows.get(3L).paid());
        assertEquals(before, rows.get(3L).createdAt());
        assertEquals(before.plusDays(1), rows.get(3L).updatedAt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"qty", "fraction", "rows", "duplicate", "unknown", "color", "vatMode",
            "date", "paid", "missingPaid", "readonly", "title"})
    void invalidSaveLeavesEntireRowUnchanged(String violation) throws Exception {
        ObjectNode w = write(1);
        ObjectNode c = (ObjectNode) w.path("content");
        ObjectNode item = (ObjectNode) c.path("items").get(0);
        switch (violation) {
            case "qty" -> item.put("qty", 100000);
            case "fraction" -> item.put("unitPrice", 0.5);
            case "rows" -> { for (int i = 0; i < 50; i++) ((com.fasterxml.jackson.databind.node.ArrayNode)
                    c.path("items")).add(item.deepCopy().put("id", "row" + i)); }
            case "duplicate" -> ((com.fasterxml.jackson.databind.node.ArrayNode) c.path("items")).add(item.deepCopy());
            case "unknown" -> ((ObjectNode) c.path("supplier")).put("secret", "x");
            case "color" -> c.put("color", "red");
            case "vatMode" -> c.put("vatMode", "none");
            case "date" -> c.put("issueDate", "yesterday");
            case "paid" -> w.put("paid", true);
            case "missingPaid" -> w.remove("paid");
            case "readonly" -> w.put("total_amount", 1);
            case "title" -> w.put("title", "\u2003\u00a0");
        }
        InvoiceRow old = rows.get(1L);
        save(1, w, 400);
        assertEquals(old, rows.get(1L));
        verify(mapper, never()).save(anyLong(), anyLong(), any(), anyString(), any());
    }

    @Test
    void oversizeUtf8Rejected() throws Exception {
        ObjectNode w = write(1);
        ((ObjectNode) w.path("content")).put("notes", "가".repeat(70000));
        save(1, w, 413);
        verify(mapper, never()).save(anyLong(), anyLong(), any(), anyString(), any());
    }

    @Test
    void ownPhotoLinkAndUnlinkOnlyChangesInvoice() throws Exception {
        ObjectNode w = write(1);
        ((ObjectNode) w.path("content")).put("stampPhotoId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        when(mapper.ownsPhoto(anyString(), eq(1L))).thenReturn(true);
        save(1, w, 204);
        assertEquals(w.get("content").toString(), rows.get(1L).content());
        ((ObjectNode) w.path("content")).putNull("stampPhotoId");
        save(1, w, 204);
        assertTrue(json.readTree(rows.get(1L).content()).get("stampPhotoId").isNull());
    }

    @Test
    void foreignPhotoRejectedBeforeMutation() throws Exception {
        ObjectNode w = write(1);
        ((ObjectNode) w.path("content")).put("stampPhotoId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        InvoiceRow old = rows.get(1L);
        save(1, w, 404);
        assertEquals(old, rows.get(1L));
    }

    @Test
    void deletePreservesNumberContentAndTimestampThenGetAndDelete404() throws Exception {
        InvoiceRow old = rows.get(1L);
        mvc.perform(delete("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertTrue(rows.get(1L).deleted());
        assertEquals(old.content(), rows.get(1L).content());
        assertEquals(old.docNo(), rows.get(1L).docNo());
        assertEquals(old.updatedAt(), rows.get(1L).updatedAt());
        mvc.perform(get("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev"))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(longs = {2, 999})
    void foreignAndAbsentTargetsAre404AndUnchanged(long id) throws Exception {
        Map<Long, InvoiceRow> old = Map.copyOf(rows);
        mvc.perform(get("/api/invoices/{id}", id).with(user("jiwoo@resume.dev"))).andExpect(status().isNotFound());
        save(id, write(1), 404);
        mvc.perform(delete("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound());
        assertEquals(old, rows);
    }

    @Test
    void anonymousEveryOperationReturns401WithoutMapperCalls() throws Exception {
        mvc.perform(get("/api/invoices")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/invoices/{id}", 1)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/invoices").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/invoices/{id}", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/invoices/{id}", 1)).andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void csrfRequiredForWrites() throws Exception {
        mvc.perform(delete("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void numberExhaustionDoesNotInsert() throws Exception {
        when(mapper.maxNumber(anyLong(), anyString(), anyString())).thenReturn(9999);
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        assertEquals(3, rows.size());
    }

    @Test
    void numberConflictRollsBackBeforeFreshRetryAndStopsAtTwo() throws Exception {
        SQLException sql = new SQLException("invoice_user_id_doc_no_key", "23505");
        when(mapper.maxNumber(anyLong(), anyString(), anyString()))
                .thenThrow(new DuplicateKeyException("number", sql)).thenReturn(2);
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isCreated());
        var ordered = inOrder(transactions);
        ordered.verify(transactions).getTransaction(any());
        ordered.verify(transactions).rollback(any());
        ordered.verify(transactions).getTransaction(any());
        ordered.verify(transactions).commit(any());
        when(mapper.maxNumber(anyLong(), anyString(), anyString()))
                .thenThrow(new DuplicateKeyException("number", sql));
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"));
        assertEquals(4, rows.size());
    }

    @Test
    void classpathContractDeclaresImplementedOperations() throws Exception {
        try (var in = new org.springframework.core.io.ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            Map<?, ?> contract = new org.yaml.snakeyaml.Yaml(
                    new org.yaml.snakeyaml.constructor.SafeConstructor(options)).load(in);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            assertEquals("listInvoices", ((Map<?, ?>) ((Map<?, ?>) paths.get("/api/invoices")).get("get"))
                    .get("operationId"));
            mvc.perform(get("/api/invoices").with(user("jiwoo@resume.dev")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.meta").isMap())
                    .andExpect(jsonPath("$.data.size").value(20));
        }
    }
}
