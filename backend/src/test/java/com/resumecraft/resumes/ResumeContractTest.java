package com.resumecraft.resumes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.*;
import com.resumecraft.common.persistence.*;
import java.time.OffsetDateTime;
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
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;

/** Real security/controller/service/validator with stateful persistence doubles, not SQL durability evidence. */
@WebMvcTest(ResumeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ResumeService.class, ResumeStructureValidator.class,
        HealthController.class})
class ResumeContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper resumes;
    @MockBean UserMapper users;
    @MockBean PhotoMapper photos;
    private final Map<Long, ResumeRow> rows = new HashMap<>();
    private final OffsetDateTime before = OffsetDateTime.parse("2025-01-01T00:00:00Z");
    private long next;

    @BeforeEach
    void setup() throws Exception {
        next = 10;
        rows.clear();
        when(users.findByEmail("jiwoo@resume.dev")).thenReturn(
                new UserRow(1L, "jiwoo@resume.dev", "지우", "hash", before, before));
        JsonNode style = json.readTree("""
                {"color":"#1F3A5F","font":"pretendard","size":"medium"}
                """);
        JsonNode content = json.readTree("""
                [{"type":"basics","hidden":false,"data":{"email":"abc@"}}]
                """);
        for (long id = 1; id <= 5; id++) {
            rows.put(id, new ResumeRow(id, id == 4 ? 2L : 1L, "문서" + id, "classic", style, content,
                    id == 5, before, before.plusSeconds(id)));
        }
        when(resumes.findOwned(anyLong(), anyLong())).thenAnswer(call -> owned(call.getArgument(0),
                call.getArgument(1)));
        when(resumes.listPage(anyLong(), nullable(String.class), anyInt(), anyLong())).thenAnswer(call ->
                matching(call.getArgument(0), call.getArgument(1)).stream()
                        .skip(call.<Long>getArgument(3)).limit(call.<Integer>getArgument(2)).toList());
        when(resumes.countOwned(anyLong(), nullable(String.class))).thenAnswer(call ->
                (long) matching(call.getArgument(0), call.getArgument(1)).size());
        when(resumes.insert(anyLong(), anyString(), anyString(), any(JsonNode.class), any(JsonNode.class)))
                .thenAnswer(call -> {
                    long id = next++;
                    rows.put(id, new ResumeRow(id, call.getArgument(0), call.getArgument(1), call.getArgument(2),
                            call.<JsonNode>getArgument(3).deepCopy(), call.<JsonNode>getArgument(4).deepCopy(),
                            false, before.plusYears(1), before.plusYears(1)));
                    return id;
                });
        when(resumes.updateOwned(anyLong(), anyLong(), anyString(), any(JsonNode.class), any(JsonNode.class)))
                .thenAnswer(call -> {
                    ResumeRow row = owned(call.getArgument(0), call.getArgument(1));
                    if (row == null) return 0;
                    rows.put(row.id(), new ResumeRow(row.id(), row.userId(), row.title(), call.getArgument(2),
                            call.getArgument(3), call.getArgument(4), false, row.createdAt(), before.plusYears(2)));
                    return 1;
                });
        when(resumes.renameOwned(anyLong(), anyLong(), anyString())).thenAnswer(call -> {
            ResumeRow row = owned(call.getArgument(0), call.getArgument(1));
            if (row == null) return 0;
            rows.put(row.id(), new ResumeRow(row.id(), row.userId(), call.getArgument(2), row.template(),
                    row.style(), row.content(), false, row.createdAt(), before.plusYears(2)));
            return 1;
        });
        when(resumes.deleteOwned(anyLong(), anyLong())).thenAnswer(call -> {
            ResumeRow row = owned(call.getArgument(0), call.getArgument(1));
            if (row == null) return 0;
            rows.put(row.id(), new ResumeRow(row.id(), row.userId(), row.title(), row.template(),
                    row.style(), row.content(), true, row.createdAt(), before.plusYears(2)));
            return 1;
        });
    }

    private ResumeRow owned(Long id, Long owner) {
        ResumeRow row = rows.get(id);
        return row != null && !row.deleted() && row.userId().equals(owner) ? row : null;
    }

    private List<ResumeRow> matching(Long owner, String filter) {
        return rows.values().stream().filter(row -> !row.deleted() && row.userId().equals(owner))
                .filter(row -> filter == null || row.title().contains(filter))
                .sorted(Comparator.comparing(ResumeRow::updatedAt).thenComparing(ResumeRow::id).reversed()).toList();
    }

    private ObjectNode body() {
        ResumeRow row = rows.get(1L);
        var body = json.createObjectNode().put("template", row.template());
        body.set("style", row.style().deepCopy());
        body.set("content", row.content().deepCopy());
        return body;
    }

    @Test
    void listScopesBeforePagingAndCountsSameFilter() throws Exception {
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].id").value("3"))
                .andExpect(jsonPath("$.meta.totalElements").value(3));
        mvc.perform(get("/api/resumes").param("size", "1").param("filter", "문서2")
                        .with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value("2"))
                .andExpect(jsonPath("$.meta.totalElements").value(1))
                .andExpect(jsonPath("$.meta.totalPages").value(1));
        verify(resumes).listPage(1L, "문서2", 1, 0L);
        mvc.perform(get("/api/resumes").param("filter", "%_").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.meta.totalElements").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101", "-1"})
    void invalidPageSize(String size) throws Exception {
        mvc.perform(get("/api/resumes").param("size", size).with(user("jiwoo@resume.dev")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("size"));
        verify(resumes, never()).listPage(anyLong(), any(), anyInt(), anyLong());
    }

    @Test
    void getReturnsOnlyPublicDocumentProjection() throws Exception {
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value("1"))
                .andExpect(jsonPath("$.data.title").value("문서1"))
                .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"))
                .andExpect(jsonPath("$.data.user_id").doesNotExist())
                .andExpect(jsonPath("$.data.deleted").doesNotExist());
    }

    @Test
    void createUsesGeneratedKeyAndSessionEmailDefaults() throws Exception {
        var response = mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\" 새 문서 \",\"template\":\"classic\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").isString()).andReturn();
        String id = json.readTree(response.getResponse().getContentAsString()).path("data").path("id").asText();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value(" 새 문서 "))
                .andExpect(jsonPath("$.data.content.length()").value(5))
                .andExpect(jsonPath("$.data.content[0].data.email").value("jiwoo@resume.dev"))
                .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"))
                .andExpect(jsonPath("$.data.style.font").value("pretendard"))
                .andExpect(jsonPath("$.data.style.size").value("medium"));
        assertThat(rows.get(Long.valueOf(id)).userId()).isEqualTo(1L);
    }

    @Test
    void invalidCreateTemplateAddsNothing() throws Exception {
        mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"문서\",\"template\":\"other\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("template"));
        assertThat(rows).hasSize(5);
        verify(resumes, never()).insert(anyLong(), anyString(), anyString(), any(), any());
    }

    @Test
    void putRetainsTitleAndUnfinishedTextAndUsesActualWriteReadback() throws Exception {
        var body = body().put("title", "덮어쓰지 않음").put("template", "modern");
        ((ObjectNode) body.path("content").get(0).path("data")).put("jobTitle", "").put("email", "abc@");
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.template").value("modern"))
                .andExpect(jsonPath("$.data.title").value("문서1"))
                .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"))
                .andExpect(jsonPath("$.data.content[0].data.jobTitle").value(""));
        assertThat(rows.get(1L).createdAt()).isEqualTo(before);
        assertThat(rows.get(1L).updatedAt()).isAfter(before.plusSeconds(1));
    }

    @Test
    void patchChangesOnlyTitleAndTimestamp() throws Exception {
        ResumeRow old = rows.get(1L);
        mvc.perform(patch("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\" 새 제목 \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.title").value(" 새 제목 "));
        assertThat(rows.get(1L).content()).isEqualTo(old.content());
        assertThat(rows.get(1L).style()).isEqualTo(old.style());
        assertThat(rows.get(1L).template()).isEqualTo(old.template());
        assertThat(rows.get(1L).createdAt()).isEqualTo(old.createdAt());
        assertThat(rows.get(1L).updatedAt()).isAfter(old.updatedAt());
    }

    @Test
    void deleteRetainsSoftDeletedRowAndExcludesItFromGetAndList() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(1L).deleted()).isTrue();
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void duplicateDeepCopiesDocumentPreservingOriginalAndItemIds() throws Exception {
        ResumeRow original = rows.get(1L);
        var response = mvc.perform(post("/api/resumes/{id}/duplicate", 1)
                        .with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isOk()).andReturn();
        String id = json.readTree(response.getResponse().getContentAsString()).path("data").path("id").asText();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("문서1 (사본)"));
        ResumeRow copy = rows.get(Long.valueOf(id));
        assertThat(copy.id()).isNotEqualTo(original.id());
        assertThat(copy.content()).isEqualTo(original.content());
        assertThat(copy.style()).isEqualTo(original.style());
        assertThat(copy.userId()).isEqualTo(original.userId());
        assertThat(rows.get(1L)).isEqualTo(original);
    }

    @Test
    void blankRenameKeepsOriginal() throws Exception {
        ResumeRow old = rows.get(1L);
        mvc.perform(patch("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"  \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        assertThat(rows.get(1L)).isEqualTo(old);
    }

    @Test
    void oversizedPutRejectsUtf8PayloadWithoutMutation() throws Exception {
        var body = body();
        ((ObjectNode) body.path("content").get(0).path("data")).put("name", "한".repeat(70000));
        ResumeRow old = rows.get(1L);
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        assertThat(rows.get(1L)).isEqualTo(old);
    }

    @Test
    void hiddenBasicsRejectedWithoutMutation() throws Exception {
        var body = body();
        ((ObjectNode) body.path("content").get(0)).put("hidden", true);
        ResumeRow old = rows.get(1L);
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertThat(rows.get(1L)).isEqualTo(old);
    }

    @Test
    void duplicateSectionRejectedWithoutMutation() throws Exception {
        var body = body();
        ((com.fasterxml.jackson.databind.node.ArrayNode) body.path("content"))
                .add(body.path("content").get(0).deepCopy());
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verify(resumes, never()).updateOwned(anyLong(), anyLong(), anyString(), any(), any());
    }

    @Test
    void foreignPhotoRejectsPutWithoutWriting() throws Exception {
        var body = body();
        ((ObjectNode) body.path("content").get(0).path("data"))
                .put("photoId", "aabbccdd-1111-2222-3333-444455556666");
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isNotFound());
        verify(resumes, never()).updateOwned(anyLong(), anyLong(), anyString(), any(), any());
    }

    @Test
    void nullPhotoDetachesWithoutAnyPhotoWrite() throws Exception {
        var body = body();
        ((ObjectNode) body.path("content").get(0).path("data")).putNull("photoId");
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.content[0].data.photoId").isEmpty());
        verifyNoInteractions(photos);
    }

    @Test
    void publicHealthUsesFoundationCsrfBootstrap() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta.csrfToken").isNotEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableOpenApiOperationsMatchActualHttpEnvelope() throws Exception {
        Map<String, Object> contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new Yaml().load(input);
        }
        var paths = (Map<String, Map<String, Map<String, Object>>>) contract.get("paths");
        assertThat(paths.get("/api/resumes").get("get").get("operationId")).isEqualTo("listResumes");
        assertThat(paths.get("/api/resumes/{id}").get("put").get("operationId")).isEqualTo("updateResume");
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void anonymousListReturns401WithoutPersistence() throws Exception {
        mvc.perform(get("/api/resumes").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousCreateReturns401WithoutPersistence() throws Exception {
        mvc.perform(post("/api/resumes").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousGetReturns401WithoutPersistence() throws Exception {
        mvc.perform(get("/api/resumes/{id}", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousPutReturns401WithoutPersistence() throws Exception {
        mvc.perform(put("/api/resumes/{id}", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousPatchReturns401WithoutPersistence() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousDeleteReturns401WithoutPersistence() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void anonymousDuplicateReturns401WithoutPersistence() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", 1).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("401"))
                .andExpect(jsonPath("$.data").doesNotExist());
        verifyNoInteractions(resumes, users, photos);
    }

    @Test
    void getForeignReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void getDeletedReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", 5).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void getMissingReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void putForeignReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void putDeletedReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", 5).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void putMissingReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content(body().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void patchForeignReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"changed\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void patchDeletedReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", 5).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"changed\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void patchMissingReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{\"title\":\"changed\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void deleteForeignReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", 4).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void deleteDeletedReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", 5).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void deleteMissingReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void duplicateForeignReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 4).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void duplicateDeletedReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 5).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }

    @Test
    void duplicateMissingReturns404AndKeepsRows() throws Exception {
        var old = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 999).with(user("jiwoo@resume.dev")).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("404"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(old);
    }
}
