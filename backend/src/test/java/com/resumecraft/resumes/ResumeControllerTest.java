package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.config.SecurityConfig;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Comparator;
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
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@WebMvcTest(ResumeController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    final Map<Long, ResumeRow> rows = new HashMap<>();
    final OffsetDateTime before = OffsetDateTime.parse("2026-01-01T00:00:00Z");
    long sequence;

    @BeforeEach
    void setup() {
        sequence = 10;
        rows.clear();
        when(mapper.account("jiwoo@resume.dev")).thenReturn(new ResumeAccount(1L, "jiwoo@resume.dev", "지우"));
        when(mapper.account("minjun@resume.dev")).thenReturn(new ResumeAccount(2L, "minjun@resume.dev", "민준"));
        var content = ResumeDefaults.content(json, new ResumeAccount(1L, "jiwoo@resume.dev", "지우"));
        rows.put(1L, new ResumeRow(1L, 1L, "원본", "classic", style().toString(),
                content.toString(), false, before, before));
        rows.put(2L, new ResumeRow(2L, 2L, "타인", "classic", style().toString(),
                content.toString(), false, before, before));
        rows.put(3L, new ResumeRow(3L, 1L, "삭제", "classic", style().toString(),
                content.toString(), true, before, before));
        when(mapper.find(anyLong(), anyLong())).thenAnswer(call -> {
            ResumeRow row = rows.get(call.getArgument(0));
            return row != null && !row.deleted() && row.userId().equals(call.getArgument(1)) ? row : null;
        });
        when(mapper.list(anyLong())).thenAnswer(call -> rows.values().stream()
                .filter(row -> !row.deleted() && row.userId().equals(call.getArgument(0)))
                .sorted(Comparator.comparing(ResumeRow::updatedAt).thenComparing(ResumeRow::id).reversed()).toList());
        when(mapper.insert(anyLong(), anyString(), anyString(), anyString(), anyString())).thenAnswer(call -> {
            long id = ++sequence;
            rows.put(id, new ResumeRow(id, call.getArgument(0), call.getArgument(1), call.getArgument(2),
                    call.getArgument(3), call.getArgument(4), false, before.plusDays(1), before.plusDays(1)));
            return id;
        });
        when(mapper.save(anyLong(), anyLong(), anyString(), anyString(), anyString(), anyString())).thenAnswer(call -> {
            ResumeRow old = rows.get(call.getArgument(0));
            rows.put(old.id(), new ResumeRow(old.id(), old.userId(), call.getArgument(2), call.getArgument(3),
                    call.getArgument(4), call.getArgument(5), old.deleted(), old.createdAt(), before.plusDays(1)));
            return 1;
        });
        when(mapper.rename(anyLong(), anyLong(), anyString())).thenAnswer(call -> {
            ResumeRow old = rows.get(call.getArgument(0));
            rows.put(old.id(), new ResumeRow(old.id(), old.userId(), call.getArgument(2), old.template(),
                    old.style(), old.content(), old.deleted(), old.createdAt(), before.plusDays(1)));
            return 1;
        });
        when(mapper.delete(anyLong(), anyLong())).thenAnswer(call -> {
            ResumeRow old = rows.get(call.getArgument(0));
            rows.put(old.id(), new ResumeRow(old.id(), old.userId(), old.title(), old.template(),
                    old.style(), old.content(), true, old.createdAt(), old.updatedAt()));
            return 1;
        });
    }

    ObjectNode style() {
        return json.createObjectNode().put("color", "#1F3A5F").put("font", "pretendard").put("size", "medium");
    }

    ObjectNode snapshot() throws Exception {
        ObjectNode write = json.createObjectNode().put("title", "변경").put("template", "modern");
        write.set("style", style());
        write.set("content", json.readTree(rows.get(1L).content()));
        return write;
    }

    @Test
    void listIsOwnerScopedLiveOrderedAndDoesNotWrite() throws Exception {
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value("1"));
        mvc.perform(get("/api/resumes").with(user("minjun@resume.dev")))
                .andExpect(jsonPath("$.data[0].id").value("2"));
        verify(mapper, never()).save(anyLong(), anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void listRejectsPaginationCandidate() throws Exception {
        mvc.perform(get("/api/resumes").param("page", "0").with(user("jiwoo@resume.dev")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("page"));
        verify(mapper, never()).list(anyLong());
    }

    @Test
    void getPreservesHiddenDraftContentWithoutMetadata() throws Exception {
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("원본"))
                .andExpect(jsonPath("$.data.content[0].data.jobTitle").value(""))
                .andExpect(jsonPath("$.data.user_id").doesNotExist())
                .andExpect(jsonPath("$.data.updated_at").value(before.toString()));
    }

    @Test
    void createUsesGeneratedKeyAndPersistedAccountDefaults() throws Exception {
        String result = mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"template\":\"classic\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString())
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(result).path("data").path("id").asText();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.title").value("새 이력서"))
                .andExpect(jsonPath("$.data.content.length()").value(5))
                .andExpect(jsonPath("$.data.content[0].data.email").value("jiwoo@resume.dev"))
                .andExpect(jsonPath("$.data.content[0].data.name").value("지우"))
                .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"));
        assertEquals(1L, rows.get(Long.valueOf(id)).userId());
    }

    @Test
    void createInvalidTemplateNeverInserts() throws Exception {
        mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"template\":\"unknown\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("template"));
        verify(mapper, never()).insert(anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void saveDraftWarningsAndCurrentEndAreRetainedWithGetReadback() throws Exception {
        ObjectNode write = snapshot();
        ((ObjectNode) write.path("content").get(0).path("data")).put("email", "abc@").put("jobTitle", "");
        ArrayNode items = (ArrayNode) write.path("content").get(2).path("items");
        items.addObject().put("id", "item").put("company", "").put("position", "")
                .put("start", "2026.12").put("end", "2020.01").put("current", true).put("description", "- 본문");
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(write.toString()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"))
                .andExpect(jsonPath("$.data.content[2].items[0].end").value("2020.01"))
                .andExpect(jsonPath("$.data.content[2].items[0].current").value(true))
                .andExpect(jsonPath("$.data.template").value("modern"));
        assertEquals(before, rows.get(1L).createdAt());
        assertFalse(rows.get(1L).deleted());
        assertEquals(before.plusDays(1), rows.get(1L).updatedAt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"hidden", "missing", "duplicate", "items", "tags", "links", "type", "field"})
    void invalidStructureDoesNotMutate(String violation) throws Exception {
        ObjectNode write = snapshot();
        ArrayNode content = (ArrayNode) write.get("content");
        switch (violation) {
            case "hidden" -> ((ObjectNode) content.get(0)).put("hidden", true);
            case "missing" -> content.remove(0);
            case "duplicate" -> content.add(content.get(1).deepCopy());
            case "items" -> {
                ArrayNode items = (ArrayNode) content.get(2).get("items");
                for (int i = 0; i < 21; i++) items.addObject();
            }
            case "tags" -> {
                ArrayNode tags = (ArrayNode) content.get(4).get("data").get("tags");
                for (int i = 0; i < 31; i++) tags.add("tag");
            }
            case "links" -> {
                ArrayNode links = (ArrayNode) content.get(0).get("data").get("links");
                for (int i = 0; i < 4; i++) links.addObject();
            }
            case "type" -> ((ObjectNode) content.get(1)).put("type", "unknown");
            case "field" -> ((ObjectNode) content.get(0).get("data")).put("name", 7);
            default -> throw new IllegalArgumentException();
        }
        ResumeRow original = rows.get(1L);
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(write.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
                .andExpect(jsonPath("$.field").isString());
        assertEquals(original, rows.get(1L));
        verify(mapper, never()).save(anyLong(), anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void contentBytesAboveLimitRejectedWithoutWrite() throws Exception {
        ObjectNode write = snapshot();
        ((ObjectNode) write.path("content").get(1).path("data")).put("body", "가".repeat(70000));
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(write.toString()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, never()).save(anyLong(), anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void foreignPhotoLinkReturns404AndPreservesResume() throws Exception {
        ObjectNode write = snapshot();
        ((ObjectNode) write.path("content").get(0).path("data"))
                .put("photoId", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        mvc.perform(put("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(write.toString())).andExpect(status().isNotFound());
        verify(mapper, never()).save(anyLong(), anyLong(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void renameOnlyChangesTitleAndTimestamp() throws Exception {
        ResumeRow original = rows.get(1L);
        mvc.perform(patch("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"title\":\"  새 제목  \"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.title").value("  새 제목  "));
        assertEquals(original.content(), rows.get(1L).content());
        assertEquals(original.style(), rows.get(1L).style());
        assertEquals(original.template(), rows.get(1L).template());
        assertEquals(original.createdAt(), rows.get(1L).createdAt());
        assertNotEquals(original.updatedAt(), rows.get(1L).updatedAt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\u2003\u00a0"})
    void renameEmptyUnicodeTitlePreservesOriginal(String title) throws Exception {
        mvc.perform(patch("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(json.createObjectNode().put("title", title).toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        assertEquals("원본", rows.get(1L).title());
    }

    @Test
    void duplicateRetainsOriginalAndCopiesExactSnapshot() throws Exception {
        ResumeRow original = rows.get(1L);
        mvc.perform(post("/api/resumes/{id}/duplicate", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").value("11"));
        mvc.perform(get("/api/resumes/{id}", 11).with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.title").value("원본 (사본)"));
        assertEquals(original, rows.get(1L));
        assertEquals(original.content(), rows.get(11L).content());
        assertEquals(original.style(), rows.get(11L).style());
        assertEquals(original.template(), rows.get(11L).template());
    }

    @Test
    void deleteRetainsPhysicalRowAndRemovesFromReads() throws Exception {
        ResumeRow original = rows.get(1L);
        mvc.perform(delete("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev")).with(csrf()))
                .andExpect(status().isNoContent());
        assertTrue(rows.get(1L).deleted());
        assertEquals(original.content(), rows.get(1L).content());
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev")))
                .andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(get("/api/resumes/{id}", 1).with(user("jiwoo@resume.dev"))).andExpect(status().isNotFound());
    }

    @Test
    void classpathContractMatchesCreateAndSaveStatusDeclarations() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(1000);
            var yaml = new org.yaml.snakeyaml.Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options));
            Map<?, ?> contract = yaml.load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> root = (Map<?, ?>) paths.get("/api/resumes");
            assertEquals("createResume", ((Map<?, ?>) root.get("post")).get("operationId"));
            assertTrue(((Map<?, ?>) ((Map<?, ?>) root.get("post")).get("responses")).containsKey("201"));
            mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                    .contentType("application/json").content("{\"template\":\"modern\"}"))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.meta").isMap());
        }
    }

    @Test
    void anonymousListReturns401BeforeCsrf() throws Exception {
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousGetReturns401BeforeCsrf() throws Exception {
        mvc.perform(get("/api/resumes/{id}", 1)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignGetReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(get("/api/resumes/{id}", 2).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void deletedGetReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(get("/api/resumes/{id}", 3).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void missingGetReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(get("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void anonymousCreateReturns401BeforeCsrf() throws Exception {
        mvc.perform(post("/api/resumes").contentType("application/json").content("{}")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousSaveReturns401BeforeCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", 1).contentType("application/json").content("{}")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignSaveReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(put("/api/resumes/{id}", 2).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content(snapshot().toString())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void deletedSaveReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(put("/api/resumes/{id}", 3).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content(snapshot().toString())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void missingSaveReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(put("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content(snapshot().toString())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void anonymousRenameReturns401BeforeCsrf() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", 1).contentType("application/json").content("{}")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignRenameReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(patch("/api/resumes/{id}", 2).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content("{\"title\":\"새 제목\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void deletedRenameReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(patch("/api/resumes/{id}", 3).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content("{\"title\":\"새 제목\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void missingRenameReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(patch("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf()).contentType("application/json").content("{\"title\":\"새 제목\"}")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void anonymousDeleteReturns401BeforeCsrf() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", 1)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignDeleteReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(delete("/api/resumes/{id}", 2).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void deletedDeleteReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(delete("/api/resumes/{id}", 3).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void missingDeleteReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(delete("/api/resumes/{id}", 999).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void anonymousDuplicateReturns401BeforeCsrf() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", 1).contentType("application/json").content("{}")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.code").value("401"));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignDuplicateReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 2).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void deletedDuplicateReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 3).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }

    @Test
    void missingDuplicateReturns404AndDoesNotMutate() throws Exception {
        Map<Long, ResumeRow> original = Map.copyOf(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", 999).with(user("jiwoo@resume.dev")).with(csrf())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("404"));
        assertEquals(original, rows);
    }
}
