package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.*;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ResumeController.class)
@ContextConfiguration(classes = ResumeCraftApplication.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    final UUID owner = UUID.fromString("10000000-0000-0000-0000-000000000001");
    final UUID id = UUID.fromString("20000000-0000-0000-0000-000000000001");
    final Map<UUID, Resume> rows = new HashMap<>();
    final Set<UUID> deleted = new HashSet<>();

    @BeforeEach
    void setup() throws Exception {
        when(mapper.owner("jiwoo@resume.dev")).thenReturn(owner);
        when(mapper.email(owner)).thenReturn("jiwoo@resume.dev");
        when(mapper.find(any(), eq(owner))).thenAnswer(a -> deleted.contains(a.getArgument(0))
            ? null : rows.get(a.getArgument(0)));
        when(mapper.list(owner)).thenAnswer(a -> rows.values().stream()
            .filter(r -> !deleted.contains(r.id()))
            .sorted(Comparator.comparing(Resume::updatedAt).reversed().thenComparing(Resume::id)).toList());
        when(mapper.insert(any(), eq(owner), any())).thenAnswer(a -> {
            UUID key = a.getArgument(0);
            ResumeWrite w = a.getArgument(2);
            rows.put(key, new Resume(key, w.title(), w.template(), w.style().deepCopy(),
                w.content().deepCopy(), OffsetDateTime.now()));
            return 1;
        });
        when(mapper.save(any(), eq(owner), any())).thenAnswer(a -> {
            UUID key = a.getArgument(0);
            ResumeWrite w = a.getArgument(2);
            rows.put(key, new Resume(key, w.title(), w.template(), w.style().deepCopy(),
                w.content().deepCopy(), OffsetDateTime.now()));
            return 1;
        });
        when(mapper.rename(any(), eq(owner), any())).thenAnswer(a -> {
            UUID key = a.getArgument(0);
            Resume r = rows.get(key);
            rows.put(key, new Resume(key, a.getArgument(2), r.template(), r.style(), r.content(),
                OffsetDateTime.now()));
            return 1;
        });
        when(mapper.delete(any(), eq(owner))).thenAnswer(a -> {
            UUID key = a.getArgument(0);
            return rows.containsKey(key) && deleted.add(key) ? 1 : 0;
        });
        ResumeWrite w = json.treeToValue(body(), ResumeWrite.class);
        rows.put(id, new Resume(id, w.title(), w.template(), w.style(), w.content(),
            OffsetDateTime.parse("2020-01-01T00:00:00Z")));
    }

    ObjectNode body() throws Exception {
        return (ObjectNode) json.readTree("""
            {"title":"지원용","template":"classic",
             "style":{"color":"#1F3A5F","font":"pretendard","size":"medium"},
             "content":[{"type":"basics","hidden":false,"data":{"name":"지우","jobTitle":"개발자",
               "email":"jiwoo@resume.dev","phone":"","links":[],"photoId":null}},
              {"type":"summary","hidden":false,"data":{"headline":"","body":"소개"}},
              {"type":"experience","hidden":true,"items":[]},
              {"type":"education","hidden":false,"items":[]},
              {"type":"skills","hidden":false,"data":{"tags":[]}}]}
            """);
    }

    @Test
    void listResumesReturnsOwnerRowsAndDoesNotPaginateCandidates() throws Exception {
        mvc.perform(get("/api/resumes?page=1&size=1").with(user("jiwoo@resume.dev")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data[0].id").value(id.toString()))
            .andExpect(jsonPath("$.data[0].updated_at").isString());
        verify(mapper, never()).save(any(), any(), any());
    }

    @Test
    void getResumePreservesHiddenContent() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.content[2].hidden").value(true))
            .andExpect(jsonPath("$.data.content[2].items").isArray());
    }

    @Test
    void createResumePersistsInitialAccountEmailAndStyle() throws Exception {
        var response = mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"template\":\"modern\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true)).andReturn();
        UUID created = UUID.fromString(
            json.readTree(response.getResponse().getContentAsString()).at("/data/id").asText());
        mvc.perform(get("/api/resumes/{id}", created).with(user("jiwoo@resume.dev")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("새 이력서"))
            .andExpect(jsonPath("$.data.content[0].data.email").value("jiwoo@resume.dev"))
            .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"))
            .andExpect(jsonPath("$.data.content.length()").value(5));
    }

    @Test
    void saveResumeAllowsIncompleteEmailAndDatesAndRetainsActualWrite() throws Exception {
        ObjectNode body = body();
        ((ObjectNode) body.at("/content/0/data")).put("name", "").put("jobTitle", "").put("email", "abc@");
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body.toString()))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.content[0].data.email").value("abc@"));
        assertThat(rows.get(id).updatedAt()).isAfter(OffsetDateTime.parse("2020-01-01T00:00:00Z"));
    }

    @Test
    void renameResumeChangesOnlyTitleAndTime() throws Exception {
        Resume prior = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"title\":\" 새 제목 \"}"))
            .andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")))
            .andExpect(jsonPath("$.data.title").value(" 새 제목 "));
        assertThat(rows.get(id).content()).isEqualTo(prior.content());
        assertThat(rows.get(id).style()).isEqualTo(prior.style());
        assertThat(rows.get(id).template()).isEqualTo(prior.template());
        assertThat(rows.get(id).updatedAt()).isAfter(prior.updatedAt());
    }

    @Test
    void duplicateResumeRetainsOriginalAndPhotoReference() throws Exception {
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", UUID.randomUUID().toString());
        Resume original = rows.get(id);
        var result = mvc.perform(post("/api/resumes/{id}/duplicate", id)
                .with(user("jiwoo@resume.dev")).with(csrf()))
            .andExpect(status().isCreated()).andReturn();
        UUID copy = UUID.fromString(json.readTree(result.getResponse().getContentAsString()).at("/data/id").asText());
        assertThat(copy).isNotEqualTo(id);
        assertThat(rows.get(copy).content()).isEqualTo(original.content());
        assertThat(rows.get(copy).style()).isEqualTo(original.style());
        mvc.perform(get("/api/resumes/{id}", copy).with(user("jiwoo@resume.dev")))
            .andExpect(jsonPath("$.data.title").value("지원용 (사본)"));
        assertThat(rows.get(id)).isEqualTo(original);
    }

    @Test
    void deleteResumeKeepsPhysicalRowAndHidesListAndDetail() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf()))
            .andExpect(status().isNoContent());
        assertThat(rows).containsKey(id);
        assertThat(deleted).contains(id);
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev"))).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev"))).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"hidden", "missing", "duplicate", "items", "tags", "links", "field", "template", "style"})
    void invalidStructureNeverWrites(String kind) throws Exception {
        ObjectNode b = body();
        var sections = (com.fasterxml.jackson.databind.node.ArrayNode) b.get("content");
        switch (kind) {
            case "hidden" -> ((ObjectNode) sections.get(0)).put("hidden", true);
            case "missing" -> sections.remove(0);
            case "duplicate" -> sections.add(sections.get(1).deepCopy());
            case "items" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(2).get("items");
                for (int i = 0; i < 21; i++) items.addObject();
            }
            case "tags" -> {
                var tags = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(4).path("data").get("tags");
                for (int i = 0; i < 31; i++) tags.add("tag");
            }
            case "links" -> {
                var links = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(0).path("data").get("links");
                for (int i = 0; i < 4; i++) links.addObject().put("label", "").put("url", "");
            }
            case "field" -> ((ObjectNode) sections.get(0).get("data")).put("name", 5);
            case "template" -> b.put("template", "unknown");
            case "style" -> ((ObjectNode) b.get("style")).put("font", "unknown");
            default -> throw new AssertionError(kind);
        }
        Resume prior = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(b.toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
            .andExpect(jsonPath("$.field").isString());
        verify(mapper, never()).save(any(), any(), any());
        assertThat(rows.get(id)).isEqualTo(prior);
    }

    @Test
    void contentTooLargeHas413AndNoWrite() throws Exception {
        ObjectNode b = body();
        ((ObjectNode) b.at("/content/1/data")).put("body", "한".repeat(67000));
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(b.toString()))
            .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, never()).save(any(), any(), any());
    }

    @Test
    void foreignPhotoReferenceHas400AndNoWrite() throws Exception {
        ObjectNode b = body();
        ((ObjectNode) b.at("/content/0/data")).put("photoId", UUID.randomUUID().toString());
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(b.toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("content[0].data.photoId"));
        verify(mapper, never()).save(any(), any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "　", " "})
    void blankRenameLeavesPriorTitle(String title) throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(json.writeValueAsString(Map.of("title", title))))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void invalidCreateTemplateDoesNotInsert() throws Exception {
        mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"template\":\"unknown\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("template"));
        verify(mapper, never()).insert(any(), any(), any());
    }

    @Test
    void listAnonymousIs401() throws Exception {
        mvc.perform(get("/api/resumes").with(csrf()).contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void detailAnonymousIs401() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void detailAbsentIs404AndNoMutation() throws Exception {
        rows.clear();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void detailDeletedIs404AndNoMutation() throws Exception {
        deleted.add(id);
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void detailForeignIs404AndNoMutation() throws Exception {
        when(mapper.find(id, owner)).thenReturn(null);
        when(mapper.delete(id, owner)).thenReturn(0);
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void createAnonymousIs401() throws Exception {
        mvc.perform(post("/api/resumes").with(csrf()).contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void saveAnonymousIs401() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void saveAbsentIs404AndNoMutation() throws Exception {
        rows.clear();
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void saveDeletedIs404AndNoMutation() throws Exception {
        deleted.add(id);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void saveForeignIs404AndNoMutation() throws Exception {
        when(mapper.find(id, owner)).thenReturn(null);
        when(mapper.delete(id, owner)).thenReturn(0);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void renameAnonymousIs401() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void renameAbsentIs404AndNoMutation() throws Exception {
        rows.clear();
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void renameDeletedIs404AndNoMutation() throws Exception {
        deleted.add(id);
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void renameForeignIs404AndNoMutation() throws Exception {
        when(mapper.find(id, owner)).thenReturn(null);
        when(mapper.delete(id, owner)).thenReturn(0);
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void deleteAnonymousIs401() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void deleteAbsentIs404AndNoMutation() throws Exception {
        rows.clear();
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void deleteDeletedIs404AndNoMutation() throws Exception {
        deleted.add(id);
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void deleteForeignIs404AndNoMutation() throws Exception {
        when(mapper.find(id, owner)).thenReturn(null);
        when(mapper.delete(id, owner)).thenReturn(0);
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void duplicateAnonymousIs401() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void duplicateAbsentIs404AndNoMutation() throws Exception {
        rows.clear();
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void duplicateDeletedIs404AndNoMutation() throws Exception {
        deleted.add(id);
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void duplicateForeignIs404AndNoMutation() throws Exception {
        when(mapper.find(id, owner)).thenReturn(null);
        when(mapper.delete(id, owner)).thenReturn(0);
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content(body().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.field").isEmpty());
        verify(mapper, never()).save(any(), any(), any());
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void approvedFixtureDeclaresExecutedOperations() throws Exception {
        var options = new org.yaml.snakeyaml.LoaderOptions();
        options.setMaxAliasesForCollections(1000);
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<?, ?> contract = new org.yaml.snakeyaml.Yaml(options).load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> path = (Map<?, ?>) paths.get("/api/resumes");
            assertThat(((Map<?, ?>) path.get("post")).get("operationId")).isEqualTo("createResume");
        }
        mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev")).with(csrf())
                .contentType("application/json").content("{\"template\":\"classic\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString());
    }
}
