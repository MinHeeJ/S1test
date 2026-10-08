package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.*;
import com.resumecraft.common.persistence.*;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.test.context.ContextConfiguration(classes = ResumeCraftApplication.class)
@WebMvcTest(ResumeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    @MockBean PhotoMapper photos;
    final SessionUser owner = new SessionUser(UUID.randomUUID(), "jiwoo@resume.dev", "지우");
    final Map<UUID, ResumeRow> rows = new HashMap<>();
    UUID id;

    RequestPostProcessor actor() {
        return authentication(new UsernamePasswordAuthenticationToken(owner, null, List.of()));
    }

    @BeforeEach
    void persistenceBoundary() throws Exception {
        rows.clear();
        when(mapper.insert(any())).thenAnswer(call -> {
            ResumeRow row = call.getArgument(0);
            rows.put(row.id(), row);
            return 1;
        });
        when(mapper.findOwned(any(), any())).thenAnswer(call -> {
            ResumeRow row = rows.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1)) && !row.deleted() ? row : null;
        });
        when(mapper.listFilteredOwned(any(), anyInt(), anyInt(), nullable(String.class))).thenAnswer(call ->
            rows.values().stream().filter(row -> row.userId().equals(call.getArgument(0)) && !row.deleted())
                .filter(row -> call.getArgument(3) == null || row.title().contains((String) call.getArgument(3)))
                .sorted(Comparator.comparing(ResumeRow::updatedAt).reversed().thenComparing(ResumeRow::id))
                .skip((Integer) call.getArgument(1)).limit((Integer) call.getArgument(2)).toList());
        when(mapper.updateOwned(any(), any(), nullable(String.class), any(), any(), any(), any()))
            .thenAnswer(call -> {
                ResumeRow row = rows.get(call.getArgument(0));
                rows.put(row.id(), new ResumeRow(row.id(), row.userId(),
                    call.getArgument(2) == null ? row.title() : call.getArgument(2), call.getArgument(3),
                    call.getArgument(4), call.getArgument(5), false, row.createdAt(), call.getArgument(6)));
                return 1;
            });
        when(mapper.renameOwned(any(), any(), any(), any())).thenAnswer(call -> {
            ResumeRow row = rows.get(call.getArgument(0));
            rows.put(row.id(), new ResumeRow(row.id(), row.userId(), call.getArgument(2), row.template(),
                row.style(), row.content(), false, row.createdAt(), call.getArgument(3)));
            return 1;
        });
        when(mapper.deleteOwned(any(), any(), any())).thenAnswer(call -> {
            ResumeRow row = rows.get(call.getArgument(0));
            if (row == null || !row.userId().equals(call.getArgument(1)) || row.deleted()) return 0;
            rows.put(row.id(), new ResumeRow(row.id(), row.userId(), row.title(), row.template(),
                row.style(), row.content(), true, row.createdAt(), call.getArgument(2)));
            return 1;
        });
        id = create();
        clearInvocations(mapper);
    }

    UUID create() throws Exception {
        String response = mvc.perform(post("/api/resumes").with(actor()).with(csrf())
                .contentType("application/json").content("{\"title\":\" 새 이력서 \",\"template\":\"classic\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
            .andReturn().getResponse().getContentAsString();
        return UUID.fromString(json.readTree(response).path("data").path("id").asText());
    }

    String update() throws Exception {
        ResumeRow row = rows.get(id);
        return json.writeValueAsString(Map.of(
            "template", row.template(), "style", row.style(), "content", row.content()));
    }

    @Test
    @DisplayName("business: POST 생성 후 GET으로 세션 이메일·초기 5종·기본 스타일·소유자를 검증")
    void createInitialBodyUsesSessionEmailAndFiveEmptySections() throws Exception {
        String response = mvc.perform(post("/api/resumes").with(actor()).with(csrf())
                .contentType("application/json")
                .content("{\"title\":\" 새 이력서 \",\"template\":\"classic\",\"user_id\":\"ignored\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").isString())
            .andReturn().getResponse().getContentAsString();
        UUID created = UUID.fromString(json.readTree(response).path("data").path("id").asText());
        mvc.perform(get("/api/resumes/{id}", created).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("새 이력서"))
            .andExpect(jsonPath("$.data.template").value("classic"))
            .andExpect(jsonPath("$.data.content.length()").value(5))
            .andExpect(jsonPath("$.data.content[0].type").value("basics"))
            .andExpect(jsonPath("$.data.content[1].type").value("summary"))
            .andExpect(jsonPath("$.data.content[2].type").value("experience"))
            .andExpect(jsonPath("$.data.content[3].type").value("education"))
            .andExpect(jsonPath("$.data.content[4].type").value("skills"))
            .andExpect(jsonPath("$.data.content[0].data.email").value(owner.email()))
            .andExpect(jsonPath("$.data.content[0].data.name").value(""))
            .andExpect(jsonPath("$.data.content[0].data.jobTitle").value(""))
            .andExpect(jsonPath("$.data.content[0].data.phone").value(""))
            .andExpect(jsonPath("$.data.content[0].data.links.length()").value(0))
            .andExpect(jsonPath("$.data.content[0].hidden").value(false))
            .andExpect(jsonPath("$.data.content[1].data.headline").value(""))
            .andExpect(jsonPath("$.data.content[1].data.body").value(""))
            .andExpect(jsonPath("$.data.content[2].items.length()").value(0))
            .andExpect(jsonPath("$.data.content[3].items.length()").value(0))
            .andExpect(jsonPath("$.data.content[4].data.tags.length()").value(0))
            .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"))
            .andExpect(jsonPath("$.data.style.font").value("pretendard"))
            .andExpect(jsonPath("$.data.style.size").value("medium"))
            .andExpect(jsonPath("$.data.user_id").doesNotExist());
        assertThat(rows.get(created).userId()).isEqualTo(owner.id());
        assertThat(rows.get(created).deleted()).isFalse();
        assertThat(rows.get(created).content().get(0).path("data").has("photoId")).isTrue();
        assertThat(rows.get(created).content().get(0).path("data").path("photoId").isNull()).isTrue();
        assertThat(rows.get(created).createdAt()).isEqualTo(rows.get(created).updatedAt());
        verify(mapper).insert(rows.get(created));
    }

    @Test void listOnlyActiveOwnedRowsWithLiteralFilterAndPagination() throws Exception {
        create();
        ResumeRow source = rows.get(id);
        UUID other = UUID.randomUUID();
        rows.put(other, new ResumeRow(other, UUID.randomUUID(), source.title(), source.template(), source.style(),
            source.content(), false, source.createdAt(), source.updatedAt()));
        mvc.perform(get("/api/resumes").with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(2)).andExpect(jsonPath("$.meta").isMap());
        mvc.perform(get("/api/resumes").param("filter", "%").with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(get("/api/resumes").param("page", "1").param("size", "1").with(actor()))
            .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test void getMissingDoesNotExposeBody() throws Exception {
        mvc.perform(get("/api/resumes/{id}", UUID.randomUUID()).with(actor())).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test void putPreservesWarningsAndOptionalTitleAndBlocksMassAssignment() throws Exception {
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(update());
        var basics = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("content").get(0).path("data");
        basics.put("email", "abc@").put("jobTitle", "");
        body.put("user_id", UUID.randomUUID().toString()).put("deleted", true);
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("새 이력서"))
            .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"));
        assertThat(rows.get(id).userId()).isEqualTo(owner.id());
        assertThat(rows.get(id).deleted()).isFalse();
    }

    @Test void putDuplicateTypesAndHiddenBasicsLeaveOriginalUnchanged() throws Exception {
        ResumeRow before = rows.get(id);
        var body = json.readTree(update());
        ((com.fasterxml.jackson.databind.node.ArrayNode) body.path("content")).add(body.path("content").get(1));
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertThat(rows.get(id)).isEqualTo(before);
    }

    @Test void putByteLimitRejectsWithoutWrite() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(" ".repeat(200001))).andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, never()).updateOwned(any(), any(), any(), any(), any(), any(), any());
    }

    @Test void putForeignPhotoIsNotFoundAndNullDoesNotDeleteBytes() throws Exception {
        var body = json.readTree(update());
        var basics = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("content").get(0).path("data");
        basics.put("photoId", UUID.randomUUID().toString());
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isNotFound());
        verify(mapper, never()).updateOwned(any(), any(), any(), any(), any(), any(), any());
        basics.putNull("photoId");
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", id).with(actor()))
            .andExpect(jsonPath("$.data.content[0].data.photoId").isEmpty());
        verify(photos, never()).insert(any());
    }

    @Test
    @DisplayName("side-effect: PATCH title만 변경하고 getResume readback의 updated_at 갱신과 불변 필드 검증")
    void patchTrimsTitleAndPreservesContent() throws Exception {
        ResumeRow before = withOldUpdatedAt();
        mvc.perform(patch("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content("{\"title\":\" 변경 \",\"template\":\"modern\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").doesNotExist());
        String response = mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("변경"))
            .andExpect(jsonPath("$.data.template").value(before.template()))
            .andExpect(jsonPath("$.data.updated_at").isString())
            .andReturn().getResponse().getContentAsString();
        JsonNode saved = json.readTree(response).path("data");
        assertThat(saved.path("content")).isEqualTo(before.content());
        assertThat(saved.path("style")).isEqualTo(before.style());
        assertThat(OffsetDateTime.parse(saved.path("updated_at").asText()))
            .isEqualTo(rows.get(id).updatedAt()).isAfter(before.updatedAt());
        assertThat(rows.get(id).id()).isEqualTo(before.id());
        assertThat(rows.get(id).userId()).isEqualTo(before.userId());
        assertThat(rows.get(id).createdAt()).isEqualTo(before.createdAt());
        assertThat(rows.get(id).deleted()).isEqualTo(before.deleted());
        verify(mapper).renameOwned(eq(id), eq(owner.id()), eq("변경"), eq(rows.get(id).updatedAt()));
        verify(mapper, never()).updateOwned(any(), any(), nullable(String.class), any(), any(), any(), any());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).deleteOwned(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("validation: 공백 title PATCH는 400·title 오류이고 쓰기 없이 GET 기존 제목 유지")
    void patchBlankTitleLeavesOriginal() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content("{\"title\":\"  \"}")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.field").value("title"))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertNoWrites();
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value(before.title()));
    }

    @Test
    @DisplayName("business: POST duplicate는 새 id·사본 제목·동일 본문과 스타일을 만들고 원본 보존")
    void duplicateCreatesDeepCopyAndOriginalIsUnchanged() throws Exception {
        ResumeRow before = rows.get(id);
        String response = mvc.perform(post("/api/resumes/{id}/duplicate", id).with(actor()).with(csrf()))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").isString()).andReturn().getResponse().getContentAsString();
        UUID copy = UUID.fromString(json.readTree(response).path("data").path("id").asText());
        assertThat(copy).isNotEqualTo(id);
        String readback = mvc.perform(get("/api/resumes/{id}", copy).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("새 이력서 (사본)"))
            .andExpect(jsonPath("$.data.template").value(before.template()))
            .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(readback).path("data").path("content")).isEqualTo(before.content());
        assertThat(json.readTree(readback).path("data").path("style")).isEqualTo(before.style());
        assertThat(rows.get(copy).userId()).isEqualTo(before.userId());
        assertThat(rows.get(copy).deleted()).isFalse();
        assertThat(rows.get(copy).style()).isEqualTo(before.style()).isNotSameAs(before.style());
        assertThat(rows.get(copy).content()).isEqualTo(before.content()).isNotSameAs(before.content());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(2);
        verify(mapper).insert(rows.get(copy));
        verify(mapper, never()).updateOwned(any(), any(), nullable(String.class), any(), any(), any(), any());
        verify(mapper, never()).renameOwned(any(), any(), any(), any());
        verify(mapper, never()).deleteOwned(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business: DELETE 논리 삭제 row 보존·GET 404·목록 제외를 검증")
    void deleteRetainsRowAndBlocksGetPutPatchDuplicate() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(delete("/api/resumes/{id}", id).with(actor()).with(csrf())).andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id).deleted()).isTrue();
        assertThat(rows.get(id).content()).isEqualTo(before.content());
        assertThat(rows.get(id).style()).isEqualTo(before.style());
        assertThat(rows.get(id).userId()).isEqualTo(before.userId());
        assertThat(rows.get(id).createdAt()).isEqualTo(before.createdAt());
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false)).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes").with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(0));
        assertThat(rows).hasSize(1);
        verify(mapper).deleteOwned(eq(id), eq(owner.id()), eq(rows.get(id).updatedAt()));
        verify(mapper, never()).insert(any());
        verifyNoInteractions(photos);
    }

    @Test void createInvalidTemplateDoesNotInsert() throws Exception {
        mvc.perform(post("/api/resumes").with(actor()).with(csrf()).contentType("application/json")
            .content("{\"title\":\"제목\",\"template\":\"other\"}")).andExpect(status().isBadRequest());
        assertThat(rows).hasSize(1);
    }

    @Test void foreignOwnerCannotReadOrMutate() throws Exception {
        var other = authentication(new UsernamePasswordAuthenticationToken(
            new SessionUser(UUID.randomUUID(), "other@example.dev", "다른 사용자"), null, List.of()));
        mvc.perform(get("/api/resumes/{id}", id).with(other)).andExpect(status().isNotFound());
        mvc.perform(put("/api/resumes/{id}", id).with(other).with(csrf()).contentType("application/json")
            .content(update())).andExpect(status().isNotFound());
        mvc.perform(patch("/api/resumes/{id}", id).with(other).with(csrf()).contentType("application/json")
            .content("{\"title\":\"타인\"}")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/resumes/{id}", id).with(other).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(other).with(csrf()))
            .andExpect(status().isNotFound());
        assertThat(rows).hasSize(1);
        assertThat(rows.get(id).deleted()).isFalse();
    }

    @Test void putHiddenBasicsLeavesOriginalUnchanged() throws Exception {
        ResumeRow before = rows.get(id);
        var body = json.readTree(update());
        ((com.fasterxml.jackson.databind.node.ObjectNode) body.path("content").get(0)).put("hidden", true);
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertThat(rows.get(id)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"links", "tags", "items", "type", "current", "color", "font", "size"})
    void putStructuralLimitsAndTypesPreventWrites(String rule) throws Exception {
        ResumeRow before = rows.get(id);
        var body = json.readTree(update());
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) body.path("content");
        var basics = (com.fasterxml.jackson.databind.node.ObjectNode) content.get(0).path("data");
        var style = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("style");
        switch (rule) {
            case "links" -> {
                var links = basics.putArray("links");
                for (int i = 0; i < 4; i++) links.addObject().put("label", "").put("url", "");
            }
            case "tags" -> {
                var tags = ((com.fasterxml.jackson.databind.node.ObjectNode) content.get(4).path("data"))
                    .putArray("tags");
                for (int i = 0; i < 31; i++) tags.add("Java");
            }
            case "items" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).path("items");
                for (int i = 0; i < 21; i++) items.addObject();
            }
            case "type" -> basics.put("name", 1);
            case "current" -> ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).path("items"))
                .addObject().put("current", "true");
            case "color" -> style.put("color", "#abc");
            case "font" -> style.put("font", "invalid");
            case "size" -> style.put("size", "invalid");
        }
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        assertThat(rows.get(id)).isEqualTo(before);
    }

    @Test void putMissingIdDoesNotUpsert() throws Exception {
        mvc.perform(put("/api/resumes/{id}", UUID.randomUUID()).with(actor()).with(csrf())
            .contentType("application/json").content(update())).andExpect(status().isNotFound());
        assertThat(rows).hasSize(1);
        verify(mapper, never()).insert(any());
    }

    @Test void putAcceptsOptionalFieldsAndWarningDatesAndPreservesOrder() throws Exception {
        var body = json.readTree(update());
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) body.path("content");
        ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).path("items")).addObject()
            .put("company", "").put("start", "bad").put("end", "2020.01").put("current", true);
        ((com.fasterxml.jackson.databind.node.ObjectNode) content.get(2)).put("hidden", true);
        var summary = content.remove(1);
        content.add(summary);
        ((com.fasterxml.jackson.databind.node.ObjectNode) body).put("title", " 新 제목 ").put("template", "modern");
        ((com.fasterxml.jackson.databind.node.ObjectNode) body.path("style")).put("color", "#aBcD12");
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf()).contentType("application/json")
            .content(body.toString())).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("新 제목"))
            .andExpect(jsonPath("$.data.template").value("modern"))
            .andExpect(jsonPath("$.data.style.color").value("#aBcD12"))
            .andExpect(jsonPath("$.data.content[1].hidden").value(true))
            .andExpect(jsonPath("$.data.content[1].items[0].start").value("bad"));
        assertThat(rows.get(id).content()).isEqualTo(content);
    }

    ResumeRow withOldUpdatedAt() {
        ResumeRow row = rows.get(id);
        ResumeRow before = new ResumeRow(id, row.userId(), row.title(), row.template(),
            row.style().deepCopy(), row.content().deepCopy(), row.deleted(), row.createdAt(),
            OffsetDateTime.parse("2000-01-01T00:00:00Z"));
        rows.put(id, before);
        return before;
    }

    ResumeRow deletedRow() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(actor()).with(csrf())).andExpect(status().isOk());
        clearInvocations(mapper, photos);
        return rows.get(id);
    }

    void assertNoWrites() {
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwned(any(), any(), nullable(String.class), any(), any(), any(), any());
        verify(mapper, never()).renameOwned(any(), any(), any(), any());
        verify(mapper, never()).deleteOwned(any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("business: deleted row PUT는 404이며 content·deleted·row 수 보존, 쓰기 없음")
    void putDeletedRowDoesNotRestoreOrUpdate() throws Exception {
        ResumeRow before = deletedRow();
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf())
                .contentType("application/json").content(update()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        assertNoWrites();
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("business: deleted row PATCH는 404이며 title·content·deleted 보존, 쓰기 없음")
    void patchDeletedRowDoesNotRenameOrRestore() throws Exception {
        ResumeRow before = deletedRow();
        mvc.perform(patch("/api/resumes/{id}", id).with(actor()).with(csrf())
                .contentType("application/json").content("{\"title\":\"새 제목\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        assertNoWrites();
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("business: deleted 원본 POST duplicate는 404이며 사본 추가와 원본 변경 없음")
    void duplicateDeletedRowDoesNotInsertCopy() throws Exception {
        ResumeRow before = deletedRow();
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(actor()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        assertNoWrites();
    }

    @Test
    @DisplayName("business: deleted row 재DELETE는 404이며 삭제 row·updated_at·row 수 불변")
    void deleteDeletedRowDoesNotChangeTimestamp() throws Exception {
        ResumeRow before = deletedRow();
        mvc.perform(delete("/api/resumes/{id}", id).with(actor()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        verify(mapper).deleteOwned(eq(id), eq(owner.id()), any());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwned(any(), any(), nullable(String.class), any(), any(), any(), any());
        verify(mapper, never()).renameOwned(any(), any(), any(), any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("validation: malformed UUID DELETE는 현재 MVC 경계에서 400, mapper 접근·쓰기 없음")
    void deleteMalformedUuidDoesNotReachPersistence() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(delete("/api/resumes/{id}", "not-a-uuid").with(actor()).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("Bad Request"))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        verifyNoInteractions(mapper, photos);
    }

    @Test
    @DisplayName("validation: malformed UUID POST duplicate는 400이며 mapper 접근·사본 생성 없음")
    void duplicateMalformedUuidDoesNotReachPersistence() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(post("/api/resumes/{id}/duplicate", "not-a-uuid").with(actor()).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("Bad Request"))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        verifyNoInteractions(mapper, photos);
    }

    @Test
    @DisplayName("validation: malformed UUID PATCH는 400이며 mapper 접근·title 변경 없음")
    void patchMalformedUuidDoesNotReachPersistence() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", "not-a-uuid").with(actor()).with(csrf())
                .contentType("application/json").content("{\"title\":\"변경\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("Bad Request"))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        verifyNoInteractions(mapper, photos);
    }

    @Test
    @DisplayName("validation: 없는 UUID DELETE는 404이며 원본·row 수 불변")
    void deleteMissingUuidLeavesRowsUnchanged() throws Exception {
        ResumeRow before = rows.get(id);
        UUID missing = UUID.randomUUID();
        mvc.perform(delete("/api/resumes/{id}", missing).with(actor()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        verify(mapper).deleteOwned(eq(missing), eq(owner.id()), any());
        verify(mapper, never()).insert(any());
        verifyNoInteractions(photos);
    }

    @Test
    @DisplayName("validation: 없는 UUID POST duplicate는 404이며 원본 불변·사본 쓰기 없음")
    void duplicateMissingUuidDoesNotInsertCopy() throws Exception {
        ResumeRow before = rows.get(id);
        mvc.perform(post("/api/resumes/{id}/duplicate", UUID.randomUUID()).with(actor()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(rows).hasSize(1);
        assertNoWrites();
    }

    @Test
    @DisplayName("side-effect: PUT 저장 후 getResume content·style·updated_at 갱신 및 불변 필드 검증")
    void putUpdatesTimestampAndReadsBackSavedBody() throws Exception {
        ResumeRow before = withOldUpdatedAt();
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) json.readTree(update());
        body.put("template", "modern").put("user_id", UUID.randomUUID().toString()).put("deleted", true);
        body.put("created_at", "1990-01-01T00:00:00Z").put("updated_at", "1990-01-01T00:00:00Z");
        ((com.fasterxml.jackson.databind.node.ObjectNode) body.path("content").get(1).path("data"))
            .put("body", "최신 저장 본문");
        ((com.fasterxml.jackson.databind.node.ObjectNode) body.path("style")).put("color", "#aBcD12");
        mvc.perform(put("/api/resumes/{id}", id).with(actor()).with(csrf())
                .contentType("application/json").content(body.toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").doesNotExist());
        String response = mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.id").value(id.toString()))
            .andExpect(jsonPath("$.data.title").value(before.title()))
            .andExpect(jsonPath("$.data.template").value("modern"))
            .andExpect(jsonPath("$.data.content[1].data.body").value("최신 저장 본문"))
            .andExpect(jsonPath("$.data.updated_at").isString())
            .andReturn().getResponse().getContentAsString();
        JsonNode saved = json.readTree(response).path("data");
        assertThat(saved.path("content")).isEqualTo(body.path("content"));
        assertThat(saved.path("style")).isEqualTo(body.path("style"));
        assertThat(OffsetDateTime.parse(saved.path("updated_at").asText()))
            .isEqualTo(rows.get(id).updatedAt()).isAfter(before.updatedAt());
        assertThat(rows.get(id).id()).isEqualTo(before.id());
        assertThat(rows.get(id).userId()).isEqualTo(before.userId());
        assertThat(rows.get(id).createdAt()).isEqualTo(before.createdAt());
        assertThat(rows.get(id).deleted()).isEqualTo(before.deleted());
        verify(mapper).updateOwned(eq(id), eq(owner.id()), isNull(), eq("modern"),
            eq(body.path("style")), eq(body.path("content")), eq(rows.get(id).updatedAt()));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).renameOwned(any(), any(), any(), any());
        verify(mapper, never()).deleteOwned(any(), any(), any());
    }

    @Test
    @DisplayName("business: classpath OpenAPI 생성 경로·template enum과 실제 POST/GET 저장본을 대조")
    void classpathContractMatchesCreatedResumeTemplate() throws Exception {
        JsonNode contract;
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = json.valueToTree(new Yaml().load(input));
        }
        JsonNode operation = contract.path("paths").path("/api/resumes").path("post");
        assertThat(operation.path("operationId").asText()).isEqualTo("createResume");
        assertThat(operation.path("requestBody").path("required").asBoolean()).isTrue();
        JsonNode templates = contract.path("components").path("schemas").path("ResumeTemplate").path("enum");
        assertThat(templates).isEqualTo(json.readTree("[\"classic\",\"modern\"]"));
        String response = mvc.perform(post("/api/resumes").with(actor()).with(csrf())
                .contentType("application/json").content("{\"title\":\"계약 확인\",\"template\":\"modern\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true))
            .andReturn().getResponse().getContentAsString();
        UUID created = UUID.fromString(json.readTree(response).path("data").path("id").asText());
        String readback = mvc.perform(get("/api/resumes/{id}", created).with(actor())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.title").value("계약 확인"))
            .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(readback).path("data").path("template")).isEqualTo(templates.get(1));
        assertThat(rows.get(created).template()).isEqualTo(templates.get(1).asText());
    }

    @Test void listInvalidPaginationIsBadRequest() throws Exception {
        mvc.perform(get("/api/resumes").param("size", "101").with(actor())).andExpect(status().isBadRequest());
        mvc.perform(get("/api/resumes").param("page", "-1").with(actor())).andExpect(status().isBadRequest());
    }

    @Test void internalFailuresNeverLeakSql() throws Exception {
        when(mapper.findOwned(id, owner.id()))
            .thenThrow(new IllegalStateException("password_hash SQL connection secret"));
        mvc.perform(get("/api/resumes/{id}", id).with(actor())).andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("Internal Server Error"))
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test void anonymousList() throws Exception {
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
    }
    @Test void anonymousGet() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id)).andExpect(status().isUnauthorized());
    }
    @Test void anonymousCreate() throws Exception {
        mvc.perform(post("/api/resumes").with(csrf()).contentType("application/json").content("{}"))
            .andExpect(status().isUnauthorized());
    }
    @Test void anonymousPut() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(csrf()).contentType("application/json").content(update()))
            .andExpect(status().isUnauthorized());
    }
    @Test void anonymousPatch() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id).with(csrf()).contentType("application/json").content("{}"))
            .andExpect(status().isUnauthorized());
    }
    @Test void anonymousDelete() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(csrf())).andExpect(status().isUnauthorized());
    }
    @Test void anonymousDuplicate() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(csrf())).andExpect(status().isUnauthorized());
    }
    @Test void authenticatedMutationRequiresCsrf() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(actor())).andExpect(status().isForbidden());
        verify(mapper, never()).deleteOwned(any(), any(), any());
    }
}
