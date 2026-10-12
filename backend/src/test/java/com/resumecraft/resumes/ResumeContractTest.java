package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.photos.PhotoMapper;
import com.resumecraft.security.SecurityConfig;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP/security/service/validation with a stateful persistence double; SQL durability is runner-owned. */
@WebMvcTest(ResumeController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    @MockBean PhotoMapper photos;
    final UUID owner = UUID.fromString("00000000-0000-0000-0000-000000000001");
    final UUID id = UUID.fromString("00000000-0000-0000-0000-000000000010");
    final Map<UUID, ResumeRecord> rows = new HashMap<>();
    final Set<UUID> deletedRows = new HashSet<>();
    final OffsetDateTime before = OffsetDateTime.parse("2025-01-01T00:00:00Z");

    @BeforeEach
    void setup() throws Exception {
        rows.clear();
        deletedRows.clear();
        var content = json.readTree("""
            [{"type":"basics","hidden":false,"data":{"name":"","jobTitle":"","email":"abc@",
            "phone":"","links":[],"photoId":null}},
            {"type":"summary","hidden":false,"data":{"headline":"","body":""}},
            {"type":"experience","hidden":true,"items":[{"id":"arbitrary-string","company":"",
            "position":"","start":"bad","end":"old","current":true,"description":"- original"}]},
            {"type":"skills","hidden":false,"data":{"tags":[]}}]
            """);
        rows.put(id, new ResumeRecord(id, "원문", "classic", json.readTree(
            "{\"color\":\"#1F3A5F\",\"font\":\"pretendard\",\"size\":\"medium\"}"), content, before));
        when(mapper.email(owner)).thenReturn("jiwoo@resume.dev");
        when(mapper.find(any(), any())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            return owner.equals(call.getArgument(1)) && !deletedRows.contains(key) ? rows.get(key) : null;
        });
        when(mapper.list(any())).thenAnswer(call -> owner.equals(call.getArgument(0))
            ? rows.values().stream().filter(row -> !deletedRows.contains(row.id()))
                .sorted(Comparator.comparing(ResumeRecord::updatedAt).reversed().thenComparing(ResumeRecord::id))
                .toList() : Collections.emptyList());
        when(mapper.insert(any(), eq(owner), any())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            ResumeWrite write = call.getArgument(2);
            rows.put(key, new ResumeRecord(key, write.title(), write.template(), write.style(),
                write.content(), before));
            return 1;
        });
        when(mapper.save(any(), any(), any())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            if (!live(key, call.getArgument(1))) return 0;
            ResumeWrite write = call.getArgument(2);
            rows.put(key, new ResumeRecord(key, write.title(), write.template(), write.style().deepCopy(),
                write.content().deepCopy(), before.plusDays(1)));
            return 1;
        });
        when(mapper.rename(any(), any(), anyString())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            if (!live(key, call.getArgument(1))) return 0;
            ResumeRecord row = rows.get(key);
            rows.put(key, new ResumeRecord(key, call.getArgument(2), row.template(), row.style(),
                row.content(), before.plusDays(1)));
            return 1;
        });
        when(mapper.delete(any(), any())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            if (!live(key, call.getArgument(1))) return 0;
            deletedRows.add(key);
            return 1;
        });
        when(mapper.duplicate(any(), any())).thenAnswer(call -> {
            UUID key = call.getArgument(0);
            if (!live(key, call.getArgument(1))) return null;
            UUID created = UUID.randomUUID();
            ResumeRecord original = rows.get(key);
            rows.put(created, new ResumeRecord(created, original.title() + " (사본)", original.template(),
                original.style().deepCopy(), original.content().deepCopy(), before.plusDays(1)));
            return created;
        });
    }

    boolean live(UUID key, UUID actor) {
        return owner.equals(actor) && rows.containsKey(key) && !deletedRows.contains(key);
    }

    MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder request) {
        return request.with(user(owner.toString())).with(csrf());
    }

    ObjectNode write() {
        ResumeRecord row = rows.get(id);
        var node = json.createObjectNode();
        node.put("title", row.title()).put("template", row.template());
        node.set("style", row.style().deepCopy());
        node.set("content", row.content().deepCopy());
        return node;
    }

    String created(MockHttpServletRequestBuilder request) throws Exception {
        var result = mvc.perform(actor(request)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.id").isString()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    @Test
    @DisplayName("side-effect: GET list preserves updated_at and performs no writes")
    void listReturnsOwnedLiveRowsWithoutWriting() throws Exception {
        ResumeRecord original = rows.get(id);
        mvc.perform(actor(get("/api/resumes"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].id").value(id.toString()))
            .andExpect(jsonPath("$.data[0].updated_at").value("2025-01-01T00:00:00Z"));
        assertThat(rows.get(id)).isEqualTo(original);
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        verify(mapper).list(owner);
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("side-effect: GET detail preserves hidden content and photoId without photo access")
    void detailPreservesHiddenOriginalAndDoesNotExposeOwner() throws Exception {
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        var originalContent = rows.get(id).content().deepCopy();
        mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[2].hidden").value(true))
            .andExpect(jsonPath("$.data.content[2].items[0].description").value("- original"))
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(photoId.toString()))
            .andExpect(jsonPath("$.data.user_id").doesNotExist());
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        verify(mapper).find(id, owner);
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business: POST ignores supplied user_id and creates for authenticated owner")
    void createUsesAccountEmailAndDocumentedDefaults() throws Exception {
        UUID foreignOwner = UUID.randomUUID();
        String created = created(post("/api/resumes")
            .contentType("application/json")
            .content(json.createObjectNode().put("template", "modern")
                .put("user_id", foreignOwner.toString()).toString()));
        mvc.perform(actor(get("/api/resumes/{id}", created))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("새 이력서"))
            .andExpect(jsonPath("$.data.template").value("modern"))
            .andExpect(jsonPath("$.data.content.length()").value(5))
            .andExpect(jsonPath("$.data.content[0].data.email").value("jiwoo@resume.dev"))
            .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"));
        verify(mapper).email(owner);
        verify(mapper).insert(eq(UUID.fromString(created)), eq(owner), any());
        mvc.perform(get("/api/resumes/{id}", created).with(user(foreignOwner.toString())))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows).hasSize(2);
        verifyNoInteractions(photos);
    }

    @Test
    void invalidCreateTemplateDoesNotInsert() throws Exception {
        mvc.perform(actor(post("/api/resumes")).contentType("application/json")
            .content("{\"template\":\"unknown\"}")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("template"));
        verify(mapper, never()).insert(any(), any(), any());
    }

    @Test
    @DisplayName("business/side-effect: PUT preserves template and warning-bearing raw content")
    void saveAllowsWarningsAndPreservesRawInput() throws Exception {
        String originalTemplate = rows.get(id).template();
        var request = write();
        request.put("title", "  changed  ");
        ((ObjectNode) request.path("content").get(0).path("data")).put("name", "  changed  ");
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("  changed  "))
            .andExpect(jsonPath("$.data.template").value(originalTemplate))
            .andExpect(jsonPath("$.data.content[0].data.name").value("  changed  "))
            .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"))
            .andExpect(jsonPath("$.data.content[2].items[0].end").value("old"))
            .andExpect(jsonPath("$.data.updated_at").exists());
        assertThat(rows.get(id).updatedAt()).isAfter(before);
        assertThat(rows.get(id).template()).isEqualTo(originalTemplate);
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business/side-effect: PUT null photoId detaches link without accessing photo storage")
    void nullPhotoDetachesWithoutPhotoMutation() throws Exception {
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        var originalContent = rows.get(id).content().deepCopy();
        var request = write();
        ((ObjectNode) request.path("content").get(0).path("data")).putNull("photoId");
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isNoContent());
        mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.data.template").value("classic"));
        ((ObjectNode) originalContent.get(0).path("data")).putNull("photoId");
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).updatedAt()).isAfter(before);
        verify(mapper).save(eq(id), eq(owner), any());
        verify(mapper, never()).ownsPhoto(any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business/side-effect: PATCH changes only title and updated_at")
    void patchChangesOnlyTitleAndTimestamp() throws Exception {
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        var originalStyle = original.style().deepCopy();
        var request = json.createObjectNode().put("title", "  제목  ").put("template", "modern")
            .put("user_id", UUID.randomUUID().toString()).put("deleted_at", before.toString());
        request.putArray("content");
        request.putObject("style").put("color", "#2563EB");
        mvc.perform(actor(patch("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isNoContent());
        mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("  제목  "));
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).style()).isEqualTo(originalStyle);
        assertThat(rows.get(id).template()).isEqualTo(original.template());
        assertThat(rows.get(id).updatedAt()).isAfter(original.updatedAt());
        assertThat(rows.get(id).id()).isEqualTo(id);
        assertThat(deletedRows).isEmpty();
        verify(mapper).rename(id, owner, "  제목  ");
        verify(mapper, never()).save(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\u00a0\u2003\u0085"})
    @DisplayName("business/side-effect: PATCH rejects blank title without changing any resume fields")
    void patchRejectsBlankTitleWithoutMutation(String title) throws Exception {
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        var originalStyle = original.style().deepCopy();
        mvc.perform(actor(patch("/api/resumes/{id}", id)).contentType("application/json")
            .content(json.createObjectNode().put("title", title).toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.field").value("title"));
        assertThat(rows.get(id).title()).isEqualTo("원문");
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).style()).isEqualTo(originalStyle);
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        verify(mapper, never()).rename(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business/side-effect: duplicate preserves source, template and photoId")
    void duplicatePreservesSourceAndReturnsNewLiveId() throws Exception {
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        String copy = created(post("/api/resumes/{id}/duplicate", id));
        mvc.perform(actor(get("/api/resumes/{id}", copy))).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("원문 (사본)"))
            .andExpect(jsonPath("$.data.template").value("classic"))
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(photoId.toString()));
        assertThat(UUID.fromString(copy)).isNotEqualTo(id);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        assertThat(rows.get(UUID.fromString(copy)).content()).isEqualTo(original.content());
        assertThat(rows.get(UUID.fromString(copy)).style()).isEqualTo(original.style());
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(2);
        verify(mapper).duplicate(id, owner);
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business/side-effect: DELETE soft-deletes without changing original photo reference")
    void deleteIsSoftAndExcludesListAndDetail() throws Exception {
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        mvc.perform(actor(delete("/api/resumes/{id}", id))).andExpect(status().isNoContent());
        assertThat(rows).containsKey(id);
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).content().get(0).path("data").path("photoId").asText())
            .isEqualTo(photoId.toString());
        assertThat(deletedRows).contains(id);
        mvc.perform(actor(get("/api/resumes"))).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isNotFound());
        verify(mapper).delete(id, owner);
        // This service-boundary check does not establish a database photo cascade policy.
        verifyNoInteractions(photos);
    }

    @ParameterizedTest
    @ValueSource(strings = {"hidden", "missing", "duplicate", "items", "tags", "links", "type", "field", "style"})
    @DisplayName("business/side-effect: PUT rejects duplicate type and invalid structure without mutation")
    void eachStructuralRuleRejectsWithoutWriting(String rule) throws Exception {
        var originalContent = rows.get(id).content().deepCopy();
        var originalStyle = rows.get(id).style().deepCopy();
        var request = write();
        var sections = (com.fasterxml.jackson.databind.node.ArrayNode) request.path("content");
        switch (rule) {
            case "hidden" -> ((ObjectNode) sections.get(0)).put("hidden", true);
            case "missing" -> sections.remove(0);
            case "duplicate" -> sections.add(sections.get(1).deepCopy());
            case "items" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(2).path("items");
                while (items.size() < 21) items.add(items.get(0).deepCopy());
            }
            case "tags" -> {
                var tags = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(3).path("data").path("tags");
                for (int i = 0; i < 31; i++) tags.add("tag");
            }
            case "links" -> {
                var links = (com.fasterxml.jackson.databind.node.ArrayNode) sections.get(0).path("data").path("links");
                for (int i = 0; i < 4; i++) links.addObject().put("label", "").put("url", "");
            }
            case "type" -> ((ObjectNode) sections.get(1)).put("type", "unknown");
            case "field" -> ((ObjectNode) sections.get(0).path("data")).put("phone", 1);
            case "style" -> ((ObjectNode) request.path("style")).put("font", "unknown");
            default -> throw new IllegalArgumentException();
        }
        var original = rows.get(id);
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"))
            .andExpect(jsonPath("$.field").isString());
        assertThat(rows.get(id)).isSameAs(original);
        verify(mapper, never()).save(any(), any(), any());
        assertThat(rows.get(id).template()).isEqualTo("classic");
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).style()).isEqualTo(originalStyle);
        if (rule.equals("duplicate")) {
            mvc.perform(actor(get("/api/resumes/{id}", id))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(4))
                .andExpect(jsonPath("$.data.content[1].type").value("summary"))
                .andExpect(jsonPath("$.data.template").value("classic"));
            assertThat(rows.get(id).content().size()).isEqualTo(4);
        }
        verifyNoInteractions(photos);
    }

    @Test
    void utf8ContentBudgetIsNotWholeRequestBudget() throws Exception {
        var request = write();
        request.put("title", "x".repeat(200001));
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isNoContent());
        ((ObjectNode) request.path("content").get(1).path("data")).put("body", "가".repeat(70000));
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, times(1)).save(any(), any(), any());
    }

    @Test
    @DisplayName("business/side-effect: PUT rejects foreign photo ownership without changing resume")
    void foreignPhotoCannotBeLinked() throws Exception {
        ResumeRecord original = rows.get(id);
        UUID photoId = UUID.randomUUID();
        var request = write();
        ((ObjectNode) request.path("content").get(0).path("data")).put("photoId", photoId.toString());
        mvc.perform(actor(put("/api/resumes/{id}", id)).contentType("application/json")
            .content(request.toString())).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        verify(mapper).ownsPhoto(photoId, owner);
        verify(mapper, never()).save(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    void csrfStillProtectsAuthenticatedWrites() throws Exception {
        mvc.perform(post("/api/resumes").with(user(owner.toString())).contentType("application/json")
            .content("{\"template\":\"classic\"}")).andExpect(status().isForbidden());
        verify(mapper, never()).insert(any(), any(), any());
    }

    @Test
    void anonymousListIs401BeforeCsrf() throws Exception {
        mvc.perform(get("/api/resumes"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousCreateIs401BeforeCsrf() throws Exception {
        mvc.perform(post("/api/resumes").contentType("application/json").content("{\"template\":\"classic\"}"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void anonymousGetIs401BeforeCsrf() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignGetIs404WithoutMutation() throws Exception {
        UUID actorId = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(get("/api/resumes/{id}", id).with(user(actorId.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void missingGetIs404WithoutMutation() throws Exception {
        UUID target = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(get("/api/resumes/{id}", target).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void deletedGetIs404WithoutMutation() throws Exception {
        deletedRows.add(id);
        ResumeRecord original = rows.get(id);
        mvc.perform(get("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void anonymousSaveIs401BeforeCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).contentType("application/json").content(write().toString()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignSaveIs404WithoutMutation() throws Exception {
        UUID actorId = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", id).contentType("application/json").content(write().toString())
                .with(user(actorId.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void missingSaveIs404WithoutMutation() throws Exception {
        UUID target = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", target).contentType("application/json").content(write().toString())
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void deletedSaveIs404WithoutMutation() throws Exception {
        deletedRows.add(id);
        ResumeRecord original = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", id).contentType("application/json").content(write().toString())
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void anonymousRenameIs401BeforeCsrf() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id).contentType("application/json").content("{\"title\":\"new\"}"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignRenameIs404WithoutMutation() throws Exception {
        UUID actorId = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", id).contentType("application/json").content("{\"title\":\"new\"}")
                .with(user(actorId.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void missingRenameIs404WithoutMutation() throws Exception {
        UUID target = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", target).contentType("application/json").content("{\"title\":\"new\"}")
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    @DisplayName("business/side-effect: PATCH deleted resume returns 404 without rename or photo access")
    void deletedRenameIs404WithoutMutation() throws Exception {
        deletedRows.add(id);
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        var originalStyle = original.style().deepCopy();
        mvc.perform(patch("/api/resumes/{id}", id).contentType("application/json").content("{\"title\":\"new\"}")
                .with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).style()).isEqualTo(originalStyle);
        assertThat(rows.get(id).title()).isEqualTo("원문");
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        assertThat(deletedRows).containsExactly(id);
        verify(mapper).find(id, owner);
        verify(mapper, never()).rename(any(), any(), any());
        verify(mapper, never()).save(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    void anonymousDeleteIs401BeforeCsrf() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignDeleteIs404WithoutMutation() throws Exception {
        UUID actorId = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(delete("/api/resumes/{id}", id).with(user(actorId.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void missingDeleteIs404WithoutMutation() throws Exception {
        UUID target = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(delete("/api/resumes/{id}", target).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    @DisplayName("business/side-effect: DELETE deleted resume returns 404 and preserves original photoId")
    void deletedDeleteIs404WithoutMutation() throws Exception {
        deletedRows.add(id);
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        mvc.perform(delete("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        assertThat(deletedRows).containsExactly(id);
        verify(mapper).delete(id, owner);
        verify(mapper, never()).save(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    void anonymousDuplicateIs401BeforeCsrf() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", id))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    void foreignDuplicateIs404WithoutMutation() throws Exception {
        UUID actorId = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user(actorId.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    void missingDuplicateIs404WithoutMutation() throws Exception {
        UUID target = UUID.randomUUID();
        ResumeRecord original = rows.get(id);
        mvc.perform(post("/api/resumes/{id}/duplicate", target).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
    }

    @Test
    @DisplayName("business/side-effect: duplicate deleted resume returns 404 without creating or changing rows")
    void deletedDuplicateIs404WithoutMutation() throws Exception {
        deletedRows.add(id);
        UUID photoId = UUID.randomUUID();
        ((ObjectNode) rows.get(id).content().get(0).path("data")).put("photoId", photoId.toString());
        ResumeRecord original = rows.get(id);
        var originalContent = original.content().deepCopy();
        var originalStyle = original.style().deepCopy();
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user(owner.toString())).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(rows.get(id)).isSameAs(original);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(id).content()).isEqualTo(originalContent);
        assertThat(rows.get(id).style()).isEqualTo(originalStyle);
        assertThat(rows.get(id).template()).isEqualTo("classic");
        assertThat(rows.get(id).updatedAt()).isEqualTo(before);
        assertThat(deletedRows).containsExactly(id);
        verify(mapper).duplicate(id, owner);
        verify(mapper, never()).insert(any(), any(), any());
        verify(mapper, never()).save(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    void durableContractFixtureDeclaresEachImplementedOperation() throws Exception {
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            var options = new org.yaml.snakeyaml.LoaderOptions();
            options.setMaxAliasesForCollections(10000);
            Map<?, ?> contract = new Yaml(new org.yaml.snakeyaml.constructor.SafeConstructor(options)).load(input);
            Map<?, ?> paths = (Map<?, ?>) contract.get("paths");
            Map<?, ?> collection = (Map<?, ?>) paths.get("/api/resumes");
            assertThat(((Map<?, ?>) collection.get("get")).get("operationId")).isEqualTo("listResumes");
            assertThat(((Map<?, ?>) collection.get("post")).get("operationId")).isEqualTo("createResume");
        }
        mvc.perform(actor(get("/api/resumes"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.meta").isMap());
    }
}
