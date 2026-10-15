package com.resumecraft.invoicesops;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.auth.UserMapper;
import com.resumecraft.auth.UserRow;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(InvoiceCopyController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, InvoiceCopyService.class})
class InvoiceCopyControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean InvoiceCopyMapper mapper;
    @MockBean UserMapper users;
    @MockBean PlatformTransactionManager transactions;
    InvoiceCopyRow quote;
    InvoiceCopyRow invoice;
    final List<List<Object>> writes = new ArrayList<>();
    final String content = """
            {"supplier":{"name":"지우"},"client":{"name":"지우"},"issueDate":"2020-01-01",
             "validUntil":"2020-12-31","items":[{"id":"a","name":"기획","qty":1,"unitPrice":3000000}],
             "vatMode":"separate","notes":"보존","stampPhotoId":null,"color":"#1F3A5F"}
            """;

    @BeforeEach
    void setup() {
        writes.clear();
        quote = new InvoiceCopyRow(1L, "quote", "홈페이지 리뉴얼 견적", content);
        invoice = new InvoiceCopyRow(2L, "invoice", "청구서", content);
        when(users.findByEmail("jiwoo@resume.dev"))
                .thenReturn(new UserRow(1L, "jiwoo@resume.dev", "지우", "not-used"));
        when(mapper.find(1L, 1L)).thenReturn(quote);
        when(mapper.find(2L, 1L)).thenReturn(invoice);
        when(transactions.getTransaction(any())).thenAnswer(call -> {
            TransactionDefinition definition = call.getArgument(0);
            assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, definition.getPropagationBehavior());
            return new SimpleTransactionStatus();
        });
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenReturn(1);
        when(mapper.insert(anyLong(), anyString(), anyString(), nullable(Long.class), anyString(),
                anyString(), anyLong(), anyLong(), anyLong())).thenAnswer(call -> {
                    writes.add(new ArrayList<>(java.util.Arrays.asList(call.getArguments())));
                    return 10L + writes.size();
                });
    }

    @Test
    void duplicateCopiesSnapshotWithNewNumberAndNoSourceMutation() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.id").value("11"));
        var row = writes.get(0);
        assertEquals("quote", row.get(1));
        assertEquals(prefix("Q") + "0002", row.get(2));
        assertNull(row.get(3));
        assertEquals(quote.title() + " (사본)", row.get(4));
        var copied = json.readTree((String) row.get(5));
        var original = json.readTree(content);
        ((com.fasterxml.jackson.databind.node.ObjectNode) original).put("issueDate", today());
        assertEquals(original, copied);
        assertEquals(content, quote.content());
        assertEquals(3300000L, row.get(8));
    }

    @Test
    void convertResetsDatesAndSourceAndCanRepeatWithoutChangingQuote() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("11"));
        when(mapper.maximum(1L, "invoice", prefix("I"))).thenReturn(2);
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("12"));
        for (var row : writes) {
            assertEquals(1L, row.get(0));
            assertEquals("invoice", row.get(1));
            assertEquals(1L, row.get(3));
            assertEquals(quote.title(), row.get(4));
            var copied = json.readTree((String) row.get(5));
            assertEquals(today(), copied.path("issueDate").asText());
            assertEquals("", copied.path("dueDate").asText());
            assertEquals("", copied.path("bankAccount").asText());
            assertFalse(copied.has("validUntil"));
            for (String field : List.of("supplier", "client", "items", "vatMode", "notes", "stampPhotoId", "color")) {
                assertEquals(json.readTree(content).get(field), copied.get(field));
            }
            assertEquals(3000000L, row.get(6));
            assertEquals(300000L, row.get(7));
            assertEquals(3300000L, row.get(8));
        }
        assertNotEquals(writes.get(0).get(2), writes.get(1).get(2));
        assertEquals(content, quote.content());
    }

    @Test
    void duplicateInvoiceClearsSourceAndPreservesOtherContent() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 2).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated());
        assertEquals("invoice", writes.get(0).get(1));
        assertNull(writes.get(0).get(3));
        assertEquals(content, invoice.content());
    }

    @Test
    void convertingInvoiceIs409AndNeverInserts() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 2).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_A_QUOTE"));
        assertTrue(writes.isEmpty());
        assertEquals(content, invoice.content());
        verify(transactions).rollback(any());
    }

    @Test
    void anonymousDuplicateIs401() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 1)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper, users, transactions);
    }

    @Test
    void anonymousConvertIs401() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 1)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper, users, transactions);
    }

    @Test
    void duplicateWithoutCsrfIs403() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void convertWithoutCsrfIs403() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isForbidden());
        verifyNoInteractions(mapper);
    }

    @Test
    void duplicateForeignSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 3).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void duplicateDeletedSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 4).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void duplicateMissingSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/duplicate", 999).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void duplicateRetry() throws Exception {
        doThrow(collision()).doReturn(20L).when(mapper).insert(anyLong(), anyString(), anyString(),
                nullable(Long.class), anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("20"));
        var order = inOrder(transactions);
        order.verify(transactions).getTransaction(any());
        order.verify(transactions).rollback(any());
        order.verify(transactions).getTransaction(any());
        order.verify(transactions).commit(any());
    }

    @Test
    void duplicateExhausted() throws Exception {
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenReturn(9999);
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void duplicateCollisionExhausted() throws Exception {
        doThrow(collision()).when(mapper).insert(anyLong(), anyString(), anyString(), nullable(Long.class),
                anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
        verify(transactions, times(2)).rollback(any());
    }

    @Test
    void convertForeignSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 3).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void convertDeletedSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 4).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void convertMissingSourceIs404AndNoInsert() throws Exception {
        mvc.perform(post("/api/invoices/{id}/convert", 999).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void convertRetry() throws Exception {
        doThrow(collision()).doReturn(20L).when(mapper).insert(anyLong(), anyString(), anyString(),
                nullable(Long.class), anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("20"));
        var order = inOrder(transactions);
        order.verify(transactions).getTransaction(any());
        order.verify(transactions).rollback(any());
        order.verify(transactions).getTransaction(any());
        order.verify(transactions).commit(any());
    }

    @Test
    void convertExhausted() throws Exception {
        when(mapper.maximum(anyLong(), anyString(), anyString())).thenReturn(9999);
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_EXHAUSTED"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
    }

    @Test
    void convertCollisionExhausted() throws Exception {
        doThrow(collision()).when(mapper).insert(anyLong(), anyString(), anyString(), nullable(Long.class),
                anyString(), anyString(), anyLong(), anyLong(), anyLong());
        mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DOCUMENT_NUMBER_CONFLICT"));
        assertTrue(writes.isEmpty());
        assertEquals(content, quote.content());
        verify(transactions, times(2)).rollback(any());
    }

    private String today() {
        return LocalDate.now(ZoneId.of("Asia/Seoul")).toString();
    }

    private String prefix(String type) {
        return type + "-" + LocalDate.now(ZoneId.of("Asia/Seoul")).getYear() + "-";
    }

    private DuplicateKeyException collision() {
        return new DuplicateKeyException("safe test", new SQLException("invoice_user_id_doc_no_key", "23505"));
    }

    @Test
    void classpathContractDeclaresBothCommandsAndObserved201() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            Map<?, ?> root = yaml.load(input);
            Map<?, ?> paths = (Map<?, ?>) root.get("paths");
            Map<?, ?> operation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/invoices/{id}/convert")).get("post");
            assertEquals("createInvoiceFromQuote", operation.get("operationId"));
            assertTrue(((Map<?, ?>) operation.get("responses")).containsKey("201"));
            mvc.perform(post("/api/invoices/{id}/convert", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                    .andExpect(status().isCreated());
            operation = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/invoices/{id}/duplicate")).get("post");
            assertEquals("duplicateInvoice", operation.get("operationId"));
            mvc.perform(post("/api/invoices/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                    .andExpect(status().isCreated());
        }
    }
}
