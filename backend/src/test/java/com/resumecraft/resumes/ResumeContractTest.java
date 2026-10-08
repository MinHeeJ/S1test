package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.*;
import com.resumecraft.common.persistence.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** CommonMvcSupport와 같은 MVC/security/JSON 설정. Mapper double의 readback은 SQL 실행 증거가 아니다. */
@SpringJUnitConfig(ResumeContractTest.WebConfig.class)
@WebAppConfiguration
class ResumeContractTest {
    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, ApiErrorHandler.class, ResumeController.class, HealthController.class,
            ResumeService.class, ResumeStructureValidator.class})
    static class WebConfig {
        @Bean ObjectMapper objectMapper() { return new ObjectMapper().findAndRegisterModules()
                .enable(com.fasterxml.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS); }
        @Bean ResumeMapper resumeMapper() { return mock(ResumeMapper.class); }
        @Bean UserMapper userMapper() { return mock(UserMapper.class); }
        @Bean PhotoMapper photoMapper() { return mock(PhotoMapper.class); }
    }

    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper json;
    @Autowired ResumeMapper mapper;
    @Autowired UserMapper users;
    @Autowired PhotoMapper photos;
    MockMvc mvc;
    final UUID owner = UUID.randomUUID();
    final UUID other = UUID.randomUUID();
    final UUID id = UUID.randomUUID();
    final UUID foreignId = UUID.randomUUID();
    final UUID deletedId = UUID.randomUUID();
    final UUID photoId = UUID.randomUUID();
    final Map<UUID, ResumeRow> rows = new HashMap<>();
    final Instant prior = Instant.parse("2025-01-01T00:00:00Z");

    @BeforeEach
    void setup() throws Exception {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        reset(mapper, users, photos);
        rows.clear();
        rows.put(id, row(id, owner, false, "제목"));
        rows.put(foreignId, row(foreignId, other, false, "타인"));
        rows.put(deletedId, row(deletedId, owner, true, "삭제됨"));
        when(users.findById(owner)).thenReturn(new UserRow(owner, "jiwoo@resume.dev", "지우", "not-a-secret",
                prior, prior));
        when(photos.findOwned(photoId, owner)).thenReturn(new PhotoRow(photoId, owner, "image/png",
                new byte[]{1, 2, 3}, prior));
        when(mapper.findOwnedActive(any(), any())).thenAnswer(call -> active(call.getArgument(0), call.getArgument(1)));
        when(mapper.insert(any())).thenAnswer(call -> {
            ResumeRow row = call.getArgument(0); rows.put(row.id(), row); return 1;
        });
        when(mapper.updateOwnedActive(any())).thenAnswer(call -> {
            ResumeRow row = call.getArgument(0);
            if (active(row.id(), row.userId()) == null) return 0;
            rows.put(row.id(), row); return 1;
        });
        when(mapper.renameOwnedActive(any(), any(), anyString())).thenAnswer(call -> {
            var old = active(call.getArgument(0), call.getArgument(1));
            if (old == null) return 0;
            rows.put(old.id(), new ResumeRow(old.id(), old.userId(), call.getArgument(2), old.template(),
                    old.style(), old.content(), false, old.createdAt(), Instant.now()));
            return 1;
        });
        when(mapper.deleteOwnedActive(any(), any())).thenAnswer(call -> {
            var old = active(call.getArgument(0), call.getArgument(1));
            if (old == null) return 0;
            rows.put(old.id(), new ResumeRow(old.id(), old.userId(), old.title(), old.template(), old.style(),
                    old.content(), true, old.createdAt(), Instant.now()));
            return 1;
        });
        when(mapper.listOwnedActive(any(), nullable(String.class), anyInt(), anyLong())).thenAnswer(call -> {
            var matching = matching(call.getArgument(0), call.getArgument(1));
            long offset = call.getArgument(3);
            int limit = call.getArgument(2);
            return matching.stream().skip(offset).limit(limit).toList();
        });
        when(mapper.countOwnedActive(any(), nullable(String.class))).thenAnswer(call ->
                (long) matching(call.getArgument(0), call.getArgument(1)).size());
    }

    ResumeRow active(UUID key, UUID userId) {
        var row = rows.get(key);
        return row != null && row.userId().equals(userId) && !row.deleted() ? row : null;
    }

    List<ResumeRow> matching(UUID userId, String pattern) {
        String literal = pattern == null ? "" : pattern.substring(1, pattern.length() - 1)
                .replace("\\%", "%").replace("\\_", "_").replace("\\\\", "\\");
        return rows.values().stream().filter(row -> !row.deleted() && row.userId().equals(userId)
                && row.title().contains(literal))
                .sorted(Comparator.comparing(ResumeRow::updatedAt).thenComparing(ResumeRow::id).reversed()).toList();
    }

    ResumeRow row(UUID key, UUID userId, boolean deleted, String title) throws Exception {
        var body = payload();
        return new ResumeRow(key, userId, title, "classic", body.get("style"), body.get("content"), deleted,
                prior, prior);
    }

    ObjectNode payload() throws Exception {
        return (ObjectNode) json.readTree("""
                {"template":"classic","style":{"color":"#1F3A5F","font":"pretendard","size":"medium"},
                 "content":[{"type":"basics","hidden":false,"data":{"name":"지우","jobTitle":"개발자",
                  "email":"jiwoo@resume.dev","phone":"","links":[],"photoId":null}},
                  {"type":"summary","hidden":false,"data":{"headline":"","body":"본문"}},
                  {"type":"experience","hidden":false,"items":[]},
                  {"type":"education","hidden":false,"items":[]},
                  {"type":"skills","hidden":false,"data":{"tags":[]}}]}
                """);
    }

    JsonNode read(UUID key) throws Exception {
        return json.readTree(mvc.perform(get("/api/resumes/{id}", key).with(user(owner.toString())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");
    }

    @Test
    @DisplayName("happy: getHealth는 세션 없이 200 success/meta이며 data를 발명하지 않는다")
    void healthPublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.meta").isMap()).andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void listOwnActiveRecentAndPaginationTotal() throws Exception {
        rows.put(UUID.randomUUID(), row(UUID.randomUUID(), owner, false, "추가"));
        mvc.perform(get("/api/resumes").with(user(owner.toString())).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.meta.total").value(2)).andExpect(jsonPath("$.meta.page").value(0));
        mvc.perform(get("/api/resumes").with(user(other.toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.meta.total").value(1))
                .andExpect(jsonPath("$.data[0].title").value("타인"));
    }

    @Test
    void listLiteralFilterUsesSameCountAndListScope() throws Exception {
        rows.put(id, row(id, owner, false, "100%_완료"));
        mvc.perform(get("/api/resumes").with(user(owner.toString())).param("filter", " %_ "))
                .andExpect(status().isOk()).andExpect(jsonPath("$.meta.total").value(1))
                .andExpect(jsonPath("$.data[0].id").value(id.toString()));
        verify(mapper).listOwnedActive(owner, "%\\%\\_%", 20, 0);
        verify(mapper).countOwnedActive(owner, "%\\%\\_%");
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "bad"})
    void invalidPageIs400(String page) throws Exception {
        mvc.perform(get("/api/resumes").with(user(owner.toString())).param("page", page))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101"})
    void invalidSizeIs400(String size) throws Exception {
        mvc.perform(get("/api/resumes").with(user(owner.toString())).param("size", size))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTrimDefaultAndGetFromActualInsert() throws Exception {
        var result = mvc.perform(post("/api/resumes").with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content("{\"title\":\"  새 제목  \",\"template\":\"modern\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.success").value(true)).andReturn();
        UUID created = UUID.fromString(json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data").path("id")
                .asText());
        JsonNode saved = read(created);
        assertThat(saved.path("title").asText()).isEqualTo("새 제목");
        assertThat(saved.path("template").asText()).isEqualTo("modern");
        assertThat(saved.path("style").path("color").asText()).isEqualTo("#1F3A5F");
        assertThat(saved.path("style").path("font").asText()).isEqualTo("pretendard");
        assertThat(saved.path("style").path("size").asText()).isEqualTo("medium");
        assertThat(saved.path("content").get(0).path("data").path("email").asText()).isEqualTo("jiwoo@resume.dev");
        assertThat(saved.path("content").get(0).path("data").path("photoId").isNull()).isTrue();
        assertThat(saved.path("content").findValuesAsText("type"))
                .containsExactly("basics", "summary", "experience", "education", "skills");
        assertThat(rows.get(created).userId()).isEqualTo(owner);
        assertThat(rows).hasSize(4);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"title\":\"\",\"template\":\"classic\"}",
            "{\"title\":\"   \",\"template\":\"classic\"}", "{\"title\":3,\"template\":\"classic\"}",
            "{\"title\":\"new\",\"template\":\"unknown\"}", "{\"title\":\"new\"}"})
    void createValidationNoInsert(String input) throws Exception {
        mvc.perform(post("/api/resumes").with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(input))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        verify(mapper, never()).insert(any());
    }

    @Test
    void getOnlyWireProjection() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id).with(user(owner.toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("제목"))
                .andExpect(jsonPath("$.data.updated_at").exists()).andExpect(jsonPath("$.data.user_id").doesNotExist())
                .andExpect(jsonPath("$.data.deleted").doesNotExist());
    }

    @Test
    @DisplayName("side-effect: PATCH title만 trim 변경하고 표현/본문/정체성을 보존한다")
    void renameReadback() throws Exception {
        var old = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content("{\"title\":\"  변경  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        assertThat(read(id).path("title").asText()).isEqualTo("변경");
        var updated = rows.get(id);
        assertThat(updated.content()).isEqualTo(old.content());
        assertThat(updated.style()).isEqualTo(old.style());
        assertThat(updated.template()).isEqualTo(old.template());
        assertThat(updated.userId()).isEqualTo(old.userId());
        assertThat(updated.createdAt()).isEqualTo(old.createdAt());
        assertThat(updated.updatedAt()).isAfter(prior);
        mvc.perform(get("/api/resumes").with(user(owner.toString())))
                .andExpect(jsonPath("$.data[0].title").value("변경"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void renameEmptyUnchanged(String title) throws Exception {
        var before = rows.get(id);
        mvc.perform(patch("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(json.writeValueAsString(Map.of("title", title))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(read(id).path("title").asText()).isEqualTo(before.title());
    }

    @Test
    void duplicateKeepsOriginalAndContentIdentity() throws Exception {
        var original = rows.get(id);
        var result = mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isCreated()).andReturn();
        var newId = UUID.fromString(json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data").path("id")
                .asText());
        assertThat(newId).isNotEqualTo(id);
        assertThat(rows.get(id)).isEqualTo(original);
        assertThat(rows.get(newId).userId()).isEqualTo(owner);
        var copy = read(newId);
        assertThat(copy.path("title").asText()).isEqualTo("제목 (사본)");
        assertThat(copy.get("content")).isEqualTo(original.content());
        assertThat(copy.get("style")).isEqualTo(original.style());
        assertThat(copy.path("template").asText()).isEqualTo(original.template());
    }

    @Test
    void deleteRetainsLogicalRowAndHidesReads() throws Exception {
        var original = rows.get(id);
        mvc.perform(delete("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        assertThat(rows.get(id).deleted()).isTrue();
        assertThat(rows.get(id).content()).isEqualTo(original.content());
        mvc.perform(get("/api/resumes/{id}", id).with(user(owner.toString())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes").with(user(owner.toString())))
                .andExpect(jsonPath("$.meta.total").value(0)).andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    @DisplayName("happy: PUT는 잘못된 이메일/날짜/빈 직무를 보존하고 title 생략 시 유지한다")
    void putWarningsNotRejectedAndSnapshotTimestamp() throws Exception {
        var body = payload();
        ((ObjectNode) body.path("content").get(0).path("data")).put("email", "abc@").put("jobTitle", "");
        ((com.fasterxml.jackson.databind.node.ArrayNode) body.path("content").get(2).path("items"))
                .addObject().put("id", UUID.randomUUID().toString()).put("company", "")
                .put("start", "2025.05").put("end", "2020.01").put("current", true).put("description", "잘못된 날짜");
        body.put("template", "modern");
        ((ObjectNode) body.path("style")).put("color", "#aBcD12");
        var before = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(body.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        JsonNode saved = read(id);
        assertThat(saved.path("content")).isEqualTo(body.get("content"));
        assertThat(saved.path("style")).isEqualTo(body.get("style"));
        assertThat(saved.path("template").asText()).isEqualTo("modern");
        assertThat(saved.path("title").asText()).isEqualTo(before.title());
        var retained = rows.get(id);
        assertThat(retained.createdAt()).isEqualTo(before.createdAt());
        assertThat(retained.userId()).isEqualTo(before.userId());
        assertThat(retained.id()).isEqualTo(id);
        assertThat(retained.deleted()).isFalse();
        assertThat(retained.updatedAt()).isAfter(before.updatedAt());
        assertThat(json.treeToValue(saved.get("updated_at"), Instant.class)).isEqualTo(retained.updatedAt());
    }

    @Test
    void putOptionalTitleAtomic() throws Exception {
        var body = payload().put("title", "  이름  ");
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(body.toString())).andExpect(status().isOk());
        assertThat(read(id).path("title").asText()).isEqualTo("이름");
    }

    @Test
    void putPhotoUnlinkPreservesBytes() throws Exception {
        var body = payload();
        ((ObjectNode) body.path("content").get(0).path("data")).put("photoId", photoId.toString());
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isOk());
        ((ObjectNode) body.path("content").get(0).path("data")).putNull("photoId");
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isOk());
        assertThat(read(id).path("content").get(0).path("data").get("photoId").isNull()).isTrue();
        assertThat(photos.findOwned(photoId, owner).data()).containsExactly((byte) 1, (byte) 2, (byte) 3);
        verify(photos, never()).insert(any());
    }

    @Test
    void putOtherPhoto404Unchanged() throws Exception {
        var body = payload();
        var before = rows.get(id);
        ((ObjectNode) body.path("content").get(0).path("data")).put("photoId", UUID.randomUUID().toString());
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isNotFound());
        assertThat(rows.get(id)).isEqualTo(before);
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void putByteLimitInclusiveAndUtf8OverflowUnchanged() throws Exception {
        var body = payload();
        var summary = (ObjectNode) body.path("content").get(1).path("data");
        summary.put("body", "");
        int overhead = json.writeValueAsBytes(body).length;
        summary.put("body", "a".repeat(200_000 - overhead));
        assertThat(json.writeValueAsBytes(body)).hasSize(200_000);
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isOk());
        var before = rows.get(id);
        summary.put("body", summary.path("body").asText() + "한");
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        assertThat(rows.get(id)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"duplicate", "hidden-basics", "first", "unknown", "hidden-type", "missing-data",
            "wrong-data", "wrong-items", "21-items", "31-tags", "4-links", "string-field", "current-type",
            "degree", "font", "size", "color", "template", "photo-type", "title"})
    void putDistinctStructuralRulesAreAtomic(String rule) throws Exception {
        var body = payload();
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) body.get("content");
        var basics = (ObjectNode) content.get(0);
        var data = (ObjectNode) basics.get("data");
        switch (rule) {
            case "duplicate" -> content.add(content.get(1).deepCopy());
            case "hidden-basics" -> basics.put("hidden", true);
            case "first" -> basics.put("type", "summary");
            case "unknown" -> ((ObjectNode) content.get(1)).put("type", "unknown");
            case "hidden-type" -> basics.put("hidden", "false");
            case "missing-data" -> basics.remove("data");
            case "wrong-data" -> basics.put("data", "bad");
            case "wrong-items" -> ((ObjectNode) content.get(2)).putObject("items");
            case "21-items" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).get("items");
                for (int i = 0; i < 21; i++) items.addObject();
            }
            case "31-tags" -> {
                var tags = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(4).path("data").get("tags");
                for (int i = 0; i < 31; i++) tags.add("tag");
            }
            case "4-links" -> {
                var links = (com.fasterxml.jackson.databind.node.ArrayNode) data.get("links");
                for (int i = 0; i < 4; i++) links.addObject();
            }
            case "string-field" -> data.put("name", 12);
            case "current-type" -> ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).get("items"))
                    .addObject().put("current", "true");
            case "degree" -> ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(3).get("items"))
                    .addObject().put("degree", "unknown");
            case "font", "size", "color" -> ((ObjectNode) body.get("style")).put(rule, "invalid");
            case "template" -> body.put("template", "unknown");
            case "photo-type" -> data.put("photoId", 12);
            case "title" -> body.put("title", "   ");
            default -> throw new IllegalArgumentException(rule);
        }
        var before = rows.get(id);
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(rule.equals("title") ? "BAD_REQUEST" : "INVALID_STRUCTURE"));
        assertThat(rows.get(id)).isEqualTo(before);
        assertThat(read(id).get("content")).isEqualTo(before.content());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void putHiddenAndOrderPreservesData() throws Exception {
        var body = payload();
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) body.get("content");
        ((ObjectNode) content.get(1)).put("hidden", true);
        var skills = content.remove(4); content.insert(1, skills);
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString())).with(csrf())
                .contentType("application/json").content(body.toString())).andExpect(status().isOk());
        assertThat(read(id).get("content")).isEqualTo(content);
    }

    @Test
    void getResumeAnonymous401() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).hasSize(3);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: getResume Foreign row는 404이고 원본/사본을 변경하지 않는다")
    void getResumeForeign404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", foreignId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: getResume Deleted row는 404이고 원본/사본을 변경하지 않는다")
    void getResumeDeleted404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", deletedId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: getResume Missing row는 404이고 원본/사본을 변경하지 않는다")
    void getResumeMissing404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(get("/api/resumes/{id}", UUID.randomUUID()).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void updateResumeAnonymous401() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id)
                        .contentType("application/json").content(payload().toString()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).hasSize(3);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: updateResume Foreign row는 404이고 원본/사본을 변경하지 않는다")
    void updateResumeForeign404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", foreignId).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(payload().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: updateResume Deleted row는 404이고 원본/사본을 변경하지 않는다")
    void updateResumeDeleted404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", deletedId).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(payload().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: updateResume Missing row는 404이고 원본/사본을 변경하지 않는다")
    void updateResumeMissing404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(put("/api/resumes/{id}", UUID.randomUUID()).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content(payload().toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void renameResumeAnonymous401() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id)
                        .contentType("application/json").content("{\"title\":\"변경\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).hasSize(3);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: renameResume Foreign row는 404이고 원본/사본을 변경하지 않는다")
    void renameResumeForeign404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", foreignId).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content("{\"title\":\"변경\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: renameResume Deleted row는 404이고 원본/사본을 변경하지 않는다")
    void renameResumeDeleted404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", deletedId).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content("{\"title\":\"변경\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: renameResume Missing row는 404이고 원본/사본을 변경하지 않는다")
    void renameResumeMissing404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(patch("/api/resumes/{id}", UUID.randomUUID()).with(user(owner.toString())).with(csrf())
                        .contentType("application/json").content("{\"title\":\"변경\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void deleteResumeAnonymous401() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).hasSize(3);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: deleteResume Foreign row는 404이고 원본/사본을 변경하지 않는다")
    void deleteResumeForeign404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", foreignId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: deleteResume Deleted row는 404이고 원본/사본을 변경하지 않는다")
    void deleteResumeDeleted404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", deletedId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: deleteResume Missing row는 404이고 원본/사본을 변경하지 않는다")
    void deleteResumeMissing404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(delete("/api/resumes/{id}", UUID.randomUUID()).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void duplicateResumeAnonymous401() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", id))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).hasSize(3);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: duplicateResume Foreign row는 404이고 원본/사본을 변경하지 않는다")
    void duplicateResumeForeign404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", foreignId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: duplicateResume Deleted row는 404이고 원본/사본을 변경하지 않는다")
    void duplicateResumeDeleted404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", deletedId).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    @DisplayName("business: duplicateResume Missing row는 404이고 원본/사본을 변경하지 않는다")
    void duplicateResumeMissing404() throws Exception {
        var before = new HashMap<>(rows);
        mvc.perform(post("/api/resumes/{id}/duplicate", UUID.randomUUID()).with(user(owner.toString())).with(csrf()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data").doesNotExist());
        assertThat(rows).isEqualTo(before);
        verify(mapper, never()).insert(any());
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void listAnonymous401() throws Exception {
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).countOwnedActive(any(), any());
    }

    @Test
    void createAnonymous401() throws Exception {
        mvc.perform(post("/api/resumes").contentType("application/json")
                        .content("{\"title\":\"new\",\"template\":\"classic\"}"))
                .andExpect(status().isUnauthorized());
        verify(mapper, never()).insert(any());
    }

    @Test
    void authenticatedWriteRequiresCsrf() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(user(owner.toString()))
                        .contentType("application/json").content(payload().toString()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verify(mapper, never()).updateOwnedActive(any());
    }

    @Test
    void unexpectedMapperErrorDoesNotLeakSqlOrCredentials() throws Exception {
        when(mapper.findOwnedActive(id, owner)).thenThrow(new IllegalStateException("SELECT password_hash jdbc:"));
        mvc.perform(get("/api/resumes/{id}", id).with(user(owner.toString())))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.success").value(false))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("SELECT"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("password"))));
    }

    @Test
    void fixtureOperationsAndSchemasMatchActualHttp() throws Exception {
        Map<?, ?> contract;
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            contract = new Yaml().load(stream);
        }
        var paths = (Map<?, ?>) contract.get("paths");
        assertThat(((Map<?, ?>) ((Map<?, ?>) paths.get("/api/resumes")).get("get")).get("operationId"))
                .isEqualTo("listResumes");
        var schemas = (Map<?, ?>) ((Map<?, ?>) contract.get("components")).get("schemas");
        var required = (Iterable<?>) ((Map<?, ?>) schemas.get("Resume")).get("required");
        var actual = read(id);
        for (Object field : required) assertThat(actual.has(field.toString())).isTrue();
    }
}
