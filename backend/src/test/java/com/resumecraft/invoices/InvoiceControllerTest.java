package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import com.resumecraft.resumes.ResumeAccount;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.sql.SQLException;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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

/** Real transport, security, validation and service; stateful persistence double is not proof of SQL durability. */
@WebMvcTest(InvoiceController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, InvoiceService.class, InvoiceStructureValidator.class})
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
        rows.clear();
        sequence = 100;
        when(transactions.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(mapper.account("jiwoo@resume.dev")).thenReturn(new ResumeAccount(1L, "jiwoo@resume.dev", "지우"));
        when(mapper.account("minjun@resume.dev")).thenReturn(new ResumeAccount(2L, "minjun@resume.dev", "민준"));
        when(mapper.account("new@resume.dev")).thenReturn(new ResumeAccount(3L, "new@resume.dev", "신규"));
        seed(1L, 1L, "quote", false);
        seed(2L, 2L, "quote", false);
        seed(3L, 1L, "quote", true);
        seed(4L, 1L, "invoice", false);
        when(mapper.find(anyLong(), anyLong())).thenAnswer(c -> {
            InvoiceRow r = rows.get(c.getArgument(0));
            return r != null && !r.deleted() && r.userId().equals(c.getArgument(1)) ? r : null;
        });
        when(mapper.list(anyLong(), nullable(String.class), anyLong())).thenAnswer(c ->
                scoped(c.getArgument(0), c.getArgument(1)).stream().skip(c.getArgument(2)).limit(20).toList());
        when(mapper.count(anyLong(), nullable(String.class))).thenAnswer(c ->
                (long) scoped(c.getArgument(0), c.getArgument(1)).size());
        when(mapper.latest(anyLong())).thenAnswer(c -> scoped(c.getArgument(0), null).stream().findFirst().orElse(null));
        when(mapper.maximum(anyLong(), anyString())).thenAnswer(c -> rows.values().stream()
                .filter(r -> r.userId().equals(c.getArgument(0)) && r.docNo().startsWith(c.getArgument(1)))
                .mapToInt(r -> Integer.parseInt(r.docNo().substring(r.docNo().length() - 4))).max().orElse(0));
        when(mapper.insert(anyLong(), anyString(), anyString(), nullable(Long.class), anyString(),
                anyString(), anyLong(), anyLong(), anyLong())).thenAnswer(c -> {
                    long id = ++sequence;
                    rows.put(id, new InvoiceRow(id, c.getArgument(0), c.getArgument(1), c.getArgument(2),
                            c.getArgument(3), c.getArgument(4), c.getArgument(5), c.getArgument(6),
                            c.getArgument(7), c.getArgument(8), false, false, before.plusDays(1), before.plusDays(1)));
                    return id;
                });
        when(mapper.save(anyLong(), anyLong(), anyString(), anyString(), anyBoolean(),
                anyLong(), anyLong(), anyLong())).thenAnswer(c -> {
                    InvoiceRow r = rows.get(c.getArgument(0));
                    rows.put(r.id(), new InvoiceRow(r.id(), r.userId(), r.docType(), r.docNo(), r.sourceQuoteId(),
                            c.getArgument(2), c.getArgument(3), c.getArgument(5), c.getArgument(6), c.getArgument(7),
                            c.getArgument(4), r.deleted(), r.createdAt(), before.plusDays(1)));
                    return 1;
                });
        when(mapper.delete(anyLong(), anyLong())).thenAnswer(c -> {
            InvoiceRow r = rows.get(c.getArgument(0));
            rows.put(r.id(), new InvoiceRow(r.id(), r.userId(), r.docType(), r.docNo(), r.sourceQuoteId(),
                    r.title(), r.content(), r.supplyAmount(), r.vatAmount(), r.totalAmount(),
                    r.paid(), true, r.createdAt(), r.updatedAt()));
            return 1;
        });
    }

    List<InvoiceRow> scoped(Long owner, String type) {
        return rows.values().stream().filter(r -> !r.deleted() && r.userId().equals(owner))
                .filter(r -> type == null || r.docType().equals(type))
                .sorted(Comparator.comparing(InvoiceRow::updatedAt).thenComparing(InvoiceRow::id).reversed()).toList();
    }

    void seed(Long id, Long owner, String type, boolean deleted) {
        var content = InvoiceDefaults.content(json, type, LocalDate.of(2026, 1, 1), null);
        content.withObject("/supplier").put("name", "공급자");
        content.withObject("/client").put("name", "수신자");
        content.withArray("items").removeAll();
        for (long price : new long[]{1000000, 1500000, 500000}) {
            content.withArray("items").addObject().put("id", UUID.randomUUID().toString())
                    .put("name", "품목").put("spec", "").put("qty", 1).put("unitPrice", price).put("note", "");
        }
        rows.put(id, new InvoiceRow(id, owner, type, (type.equals("quote") ? "Q-" : "I-")
                + LocalDate.now(ZoneId.of("Asia/Seoul")).getYear() + String.format("-%04d", id),
                null, "원본", content.toString(), 3000000L, 300000L, 3300000L, false, deleted, before, before));
    }

    ObjectNode snapshot(long id) throws Exception {
        var body = json.createObjectNode().put("title", "변경").put("paid", rows.get(id).paid());
        body.set("content", json.readTree(rows.get(id).content()));
        return body;
    }

    JsonNode read(String id) throws Exception {
        return json.readTree(mvc.perform(get("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");
    }

    @Test
    void listFiltersCountAndOwnerWithoutMutation() throws Exception {
        var old = Map.copyOf(rows);
        mvc.perform(get("/api/invoices").param("type", "quote").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value("1"))
                .andExpect(jsonPath("$.data.items[0].total_amount").value(3300000));
        mvc.perform(get("/api/invoices").param("type", "invoice").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].doc_type").value("invoice"));
        assertEquals(old, rows);
    }

    @Test
    void paginationHasNoOverlappingIds() throws Exception {
        rows.clear();
        for (long i = 1; i <= 21; i++) seed(i, 1L, "quote", false);
        String first = mvc.perform(get("/api/invoices").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.items.length()").value(20))
                .andExpect(jsonPath("$.data.total").value(21)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        mvc.perform(get("/api/invoices").param("page", "2").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value("1"));
        for (JsonNode item : json.readTree(first).path("data").path("items")) assertNotEquals("1", item.path("id").asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"type", "page", "size"})
    void invalidListQuery(String field) throws Exception {
        mvc.perform(get("/api/invoices").param(field, "0").with(user("jiwoo@resume.dev")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value(field));
    }

    @Test
    void getReturnsEveryMetadataFieldAndExactAmounts() throws Exception {
        JsonNode result = read("1");
        assertEquals("1", result.path("user_id").asText());
        assertTrue(result.has("source_quote_id"));
        assertTrue(result.path("source_quote_id").isNull());
        assertEquals(3000000, result.path("supply_amount").asLong());
        assertEquals(300000, result.path("vat_amount").asLong());
        assertEquals(3300000, result.path("total_amount").asLong());
        assertFalse(result.path("deleted").asBoolean());
        assertTrue(result.has("created_at"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2", "3", "999", "bad"})
    void getRejectsNonOwnedDeletedMissing(String id) throws Exception {
        mvc.perform(get("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void createReadbackUsesServerNumberAndOnlyRecentSupplierStamp() throws Exception {
        InvoiceRow source = rows.get(4L);
        String response = mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString())
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        String id = json.readTree(response).path("data").path("id").asText();
        JsonNode doc = read(id);
        assertTrue(doc.path("doc_no").asText().endsWith("0004"));
        assertEquals("새 견적서", doc.path("title").asText());
        assertEquals("공급자", doc.at("/content/supplier/name").asText());
        assertEquals("", doc.at("/content/client/name").asText());
        assertEquals(1, doc.at("/content/items").size());
        assertFalse(doc.path("paid").asBoolean());
        assertEquals(source, rows.get(4L));
    }

    @Test
    void createForNewOwnerUsesEmptyDefaultsAndSeoulToday() throws Exception {
        mvc.perform(post("/api/invoices").with(user("new@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"invoice\"}"))
                .andExpect(status().isCreated());
        InvoiceRow r = rows.get(101L);
        JsonNode c = json.readTree(r.content());
        assertEquals(3L, r.userId());
        assertEquals("", c.at("/supplier/name").asText());
        assertTrue(c.path("stampPhotoId").isNull());
        assertEquals(LocalDate.now(ZoneId.of("Asia/Seoul")).toString(), c.path("issueDate").asText());
        assertEquals("separate", c.path("vatMode").asText());
        assertEquals("#1F3A5F", c.path("color").asText());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"docType\":\"unknown\"}",
            "{\"docType\":\"quote\",\"doc_no\":\"Q-2026-0001\"}"})
    void invalidCreateNeverInserts(String body) throws Exception {
        var old = Map.copyOf(rows);
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertEquals(old, rows);
    }

    @Test
    void numberExhaustionDoesNotInsert() throws Exception {
        when(mapper.maximum(anyLong(), anyString())).thenReturn(9999);
        var old = Map.copyOf(rows);
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        assertEquals(old, rows);
    }

    @Test
    void uniqueConflictRollsBackThenStartsNewAttempt() throws Exception {
        doThrow(new DuplicateKeyException("duplicate", new SQLException("uq_invoice_user_doc_no", "23505")))
                .doReturn(102L).when(mapper).insert(anyLong(), anyString(), anyString(), nullable(Long.class),
                        anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("102"));
        var order = inOrder(transactions);
        order.verify(transactions).getTransaction(argThat(d -> d.getPropagationBehavior()
                == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        order.verify(transactions).rollback(any());
        order.verify(transactions).getTransaction(any());
        order.verify(transactions).commit(any());
    }

    @Test
    void secondUniqueConflictIsSafe409() throws Exception {
        doThrow(new DuplicateKeyException("duplicate", new SQLException("uq_invoice_user_doc_no", "23505")))
                .when(mapper).insert(anyLong(), anyString(), anyString(), nullable(Long.class),
                        anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"docType\":\"quote\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"));
        assertEquals(4, rows.size());
        verify(transactions, times(2)).rollback(any());
    }

    @Test
    void saveRecalculatesAndPreservesIdentityCreationAndMissingPdfValues() throws Exception {
        ObjectNode body = snapshot(1L);
        ((ObjectNode) body.at("/content/client")).put("name", "");
        mvc.perform(put("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        JsonNode doc = read("1");
        assertEquals("", doc.at("/content/client/name").asText());
        assertEquals(3300000, doc.path("total_amount").asLong());
        assertEquals(before, rows.get(1L).createdAt());
        assertEquals(before.plusDays(1), rows.get(1L).updatedAt());
    }

    @Test
    void invoicePaidCanToggleBothWaysAndContentEditRetainsPaid() throws Exception {
        ObjectNode body = snapshot(4L).put("paid", true);
        mvc.perform(put("/api/invoices/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNoContent());
        assertTrue(read("4").path("paid").asBoolean());
        body.put("title", "입금 후 변경");
        mvc.perform(put("/api/invoices/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNoContent());
        assertTrue(read("4").path("paid").asBoolean());
        body.put("paid", false);
        mvc.perform(put("/api/invoices/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNoContent());
        assertFalse(read("4").path("paid").asBoolean());
    }

    @ParameterizedTest
    @ValueSource(strings = {"qty", "fraction", "rows", "duplicate", "readonly", "unknown", "paid", "title",
            "color", "vat", "date", "missing", "supplier"})
    void invalidSavePreservesEntireRow(String rule) throws Exception {
        ObjectNode body = snapshot(1L);
        ObjectNode c = (ObjectNode) body.get("content");
        ObjectNode first = (ObjectNode) c.withArray("items").get(0);
        switch (rule) {
            case "qty" -> first.put("qty", 100000);
            case "fraction" -> first.put("unitPrice", 0.1);
            case "rows" -> { for (int i = 0; i < 51; i++) c.withArray("items").add(first.deepCopy()); }
            case "duplicate" -> c.withArray("items").add(first.deepCopy());
            case "readonly" -> body.put("total_amount", 1);
            case "unknown" -> c.put("hidden", false);
            case "paid" -> body.put("paid", true);
            case "title" -> body.put("title", "\u2003");
            case "color" -> c.put("color", "red");
            case "vat" -> c.put("vatMode", "bad");
            case "date" -> c.put("issueDate", "2026.01.01");
            case "missing" -> c.remove("notes");
            case "supplier" -> c.withObject("/supplier").put("name", 1);
            default -> fail("unexpected rule");
        }
        InvoiceRow old = rows.get(1L);
        mvc.perform(put("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertEquals(old, rows.get(1L));
    }

    @Test
    void contentLimitUsesUtf8Bytes() throws Exception {
        ObjectNode body = snapshot(1L);
        ((ObjectNode) body.get("content")).put("notes", "가".repeat(70000));
        var old = rows.get(1L);
        mvc.perform(put("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        assertEquals(old, rows.get(1L));
    }

    @Test
    void ownStampIsLinkedAndForeignStampPreservesRow() throws Exception {
        String stamp = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        ObjectNode body = snapshot(1L);
        ((ObjectNode) body.get("content")).put("stampPhotoId", stamp);
        when(mapper.ownsPhoto(stamp, 1L)).thenReturn(true);
        mvc.perform(put("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNoContent());
        assertEquals(stamp, read("1").at("/content/stampPhotoId").asText());
        InvoiceRow old = rows.get(1L);
        when(mapper.ownsPhoto(stamp, 1L)).thenReturn(false);
        mvc.perform(put("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNotFound());
        assertEquals(old, rows.get(1L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2", "3", "999"})
    void nonOwnedDeletedMissingPutNeverWrites(String id) throws Exception {
        var old = Map.copyOf(rows);
        mvc.perform(put("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(snapshot(1L).toString())).andExpect(status().isNotFound());
        assertEquals(old, rows);
    }

    @Test
    void deleteRetainsNumberContentAndTimestampThenRejectsAllAccess() throws Exception {
        InvoiceRow old = rows.get(1L);
        mvc.perform(delete("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertTrue(rows.get(1L).deleted());
        assertEquals(old.docNo(), rows.get(1L).docNo());
        assertEquals(old.content(), rows.get(1L).content());
        assertEquals(old.updatedAt(), rows.get(1L).updatedAt());
        mvc.perform(get("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/invoices").param("type", "quote").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.total").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2", "3", "999"})
    void foreignRepeatedMissingDeletePreservesRows(String id) throws Exception {
        var old = Map.copyOf(rows);
        mvc.perform(delete("/api/invoices/{id}", id).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound());
        assertEquals(old, rows);
    }

    @Test
    void anonymousListIs401WithoutContent() throws Exception {
        mvc.perform(get("/api/invoices")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousGetIs401() throws Exception {
        mvc.perform(get("/api/invoices/{id}", 1)).andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousCreateIs401() throws Exception {
        mvc.perform(post("/api/invoices").contentType("application/json").content("{\"docType\":\"invoice\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals(4, rows.size());
    }

    @Test
    void anonymousPutIs401() throws Exception {
        mvc.perform(put("/api/invoices/{id}", 1).contentType("application/json").content(snapshot(1).toString()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousDeleteIs401() throws Exception {
        mvc.perform(delete("/api/invoices/{id}", 1)).andExpect(status().isUnauthorized());
        verifyNoInteractions(mapper);
    }

    @Test
    void csrfIsStillRequired() throws Exception {
        mvc.perform(delete("/api/invoices/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        assertFalse(rows.get(1L).deleted());
    }

    @Test
    void durableContractFixtureLoadsFromClasspath() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var contract = new org.yaml.snakeyaml.Yaml(options).loadAs(input, Map.class);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> operation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/invoices")).get("get");
            assertEquals("listInvoices", operation.get("operationId"));
            mvc.perform(get("/api/invoices").with(user("jiwoo@resume.dev")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.size").value(20));
        }
    }
}
