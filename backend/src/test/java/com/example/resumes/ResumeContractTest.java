package com.example.resumes;

import com.example.common.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
    controllers = ResumeController.class,
    excludeAutoConfiguration =
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@org.springframework.test.context.ContextConfiguration(classes = ResumeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    final UUID owner = UUID.randomUUID();
    final UUID other = UUID.randomUUID();
    final Map<UUID, Resume> rows = new LinkedHashMap<>();
    UUID id;

    @BeforeEach
    void setup() throws Exception {
        rows.clear();
        when(mapper.userId("jiwoo@resume.dev")).thenReturn(owner);
        when(mapper.email(owner)).thenReturn("jiwoo@resume.dev");
        when(mapper.insert(any())).thenAnswer(call -> {
            Resume row = call.getArgument(0);
            row.setId(UUID.randomUUID());
            row.setCreatedAt(OffsetDateTime.parse("2025-01-01T00:00:00Z"));
            row.setUpdatedAt(row.getCreatedAt());
            rows.put(row.getId(), copy(row));
            return 1;
        });
        when(mapper.find(any(), any())).thenAnswer(call -> scoped(call.getArgument(0), call.getArgument(1)));
        when(mapper.lock(any(), any())).thenAnswer(call -> scoped(call.getArgument(0), call.getArgument(1)));
        when(mapper.update(any())).thenAnswer(call -> retain(call.getArgument(0)));
        when(mapper.rename(any())).thenAnswer(call -> retain(call.getArgument(0)));
        when(mapper.delete(any())).thenAnswer(call -> {
            Resume row = call.getArgument(0);
            row.setDeleted(true);
            return retain(row);
        });
        when(mapper.list(any(), nullable(String.class), anyInt(), anyLong())).thenAnswer(call -> {
            UUID user = call.getArgument(0);
            String filter = call.getArgument(1);
            int size = call.getArgument(2);
            long offset = call.getArgument(3);
            return visible(user, filter).stream().skip(offset).limit(size).toList();
        });
        when(mapper.count(any(), nullable(String.class))).thenAnswer(call ->
            (long) visible(call.getArgument(0), call.getArgument(1)).size());
        id = create("기존 제목");
        clearInvocations(mapper);
    }

    Resume copy(Resume row) {
        Resume result = new Resume();
        result.setId(row.getId());
        result.setUserId(row.getUserId());
        result.setTitle(row.getTitle());
        result.setTemplate(row.getTemplate());
        result.setStyle(row.getStyle().deepCopy());
        result.setContent(row.getContent().deepCopy());
        result.setDeleted(row.getDeleted());
        result.setCreatedAt(row.getCreatedAt());
        result.setUpdatedAt(row.getUpdatedAt());
        return result;
    }

    Resume scoped(UUID key, UUID user) {
        Resume row = rows.get(key);
        return row == null || row.getDeleted() || !row.getUserId().equals(user) ? null : copy(row);
    }

    int retain(Resume row) {
        rows.put(row.getId(), copy(row));
        return 1;
    }

    List<Resume> visible(UUID user, String filter) {
        return rows.values().stream().filter(r -> !r.getDeleted() && r.getUserId().equals(user))
            .filter(r -> filter == null || r.getTitle().contains(filter.replace("%", "")))
            .sorted(Comparator.comparing(Resume::getUpdatedAt).reversed().thenComparing(Resume::getId))
            .map(this::copy).toList();
    }

    UUID create(String title) throws Exception {
        var result = mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json")
            .content(json.createObjectNode().put("title", title).put("template", "classic").toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true)).andReturn();
        return UUID.fromString(json.readTree(result.getResponse().getContentAsString())
            .path("data").path("id").asText());
    }

    ObjectNode payload() {
        Resume row = rows.get(id);
        var body = json.createObjectNode();
        body.put("template", row.getTemplate());
        body.set("style", row.getStyle().deepCopy());
        body.set("content", row.getContent().deepCopy());
        return body;
    }

    @Test
    void createInitialSnapshotAndReadback() throws Exception {
        UUID created = create(" 새 제목 ");
        mvc.perform(get("/api/resumes/{id}", created).with(user("jiwoo@resume.dev").roles()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.title").value("새 제목"))
            .andExpect(jsonPath("$.data.content.length()").value(5))
            .andExpect(jsonPath("$.data.content[0].data.email").value("jiwoo@resume.dev"))
            .andExpect(jsonPath("$.data.style.color").value("#1F3A5F"))
            .andExpect(jsonPath("$.data.style.font").value("pretendard"))
            .andExpect(jsonPath("$.data.style.size").value("medium"))
            .andExpect(jsonPath("$.data.user_id").doesNotExist())
            .andExpect(jsonPath("$.data.deleted").doesNotExist());
        assertThat(rows.get(created).getUserId()).isEqualTo(owner);
    }

    @Test
    void listScopesAndPagesWithMatchingCount() throws Exception {
        UUID foreign = create("타인");
        rows.get(foreign).setUserId(other);
        UUID deleted = create("삭제");
        rows.get(deleted).setDeleted(true);
        mvc.perform(get("/api/resumes").param("filter", "기존").param("size", "1")
            .with(user("jiwoo@resume.dev").roles())).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.meta.totalElements").value(1))
            .andExpect(jsonPath("$.meta.totalPages").value(1));
        mvc.perform(get("/api/resumes").param("page", "9").with(user("jiwoo@resume.dev").roles()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void renameOnlyTitleAndTimestamp() throws Exception {
        Resume before = copy(rows.get(id));
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content("{\"title\":\" 변경 \"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()))
            .andExpect(jsonPath("$.data.title").value("변경"));
        Resume after = rows.get(id);
        assertThat(after.getContent()).isEqualTo(before.getContent());
        assertThat(after.getStyle()).isEqualTo(before.getStyle());
        assertThat(after.getTemplate()).isEqualTo(before.getTemplate());
        assertThat(after.getCreatedAt()).isEqualTo(before.getCreatedAt());
        assertThat(after.getUpdatedAt()).isAfter(before.getUpdatedAt());
    }

    @Test
    void updatePreservesPartialValuesHiddenDataAndTitle() throws Exception {
        ObjectNode input = payload();
        ((ObjectNode) input.path("content").get(0).path("data")).put("email", "abc@").put("jobTitle", "");
        ((ObjectNode) input.path("content").get(1)).put("hidden", true);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(input.toString())).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()))
            .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"))
            .andExpect(jsonPath("$.data.content[1].hidden").value(true))
            .andExpect(jsonPath("$.data.title").value("기존 제목"));
    }

    @Test
    void duplicateExactSnapshotAndKeepSource() throws Exception {
        Resume before = copy(rows.get(id));
        var result = mvc.perform(post("/api/resumes/{id}/duplicate", id)
            .with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isOk()).andReturn();
        UUID copyId = UUID.fromString(json.readTree(result.getResponse().getContentAsString())
            .path("data").path("id").asText());
        assertThat(copyId).isNotEqualTo(id);
        assertThat(rows.get(copyId).getTitle()).isEqualTo("기존 제목 (사본)");
        assertThat(rows.get(copyId).getContent()).isEqualTo(before.getContent());
        assertThat(rows.get(copyId).getStyle()).isEqualTo(before.getStyle());
        assertThat(rows.get(id).getTitle()).isEqualTo(before.getTitle());
        mvc.perform(get("/api/resumes/{id}", copyId).with(user("jiwoo@resume.dev").roles()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.template").value(before.getTemplate()));
    }

    @Test
    void deleteRetainsRowButHidesGetAndList() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isOk());
        assertThat(rows.get(id).getDeleted()).isTrue();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev").roles()))
            .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void photoDetachDoesNotDeletePhotoAndUnknownPhotoIs404() throws Exception {
        ObjectNode input = payload();
        ((ObjectNode) input.path("content").get(0).path("data")).put("photoId", UUID.randomUUID().toString());
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(input.toString())).andExpect(status().isNotFound());
        verify(mapper, never()).update(any());
        ((ObjectNode) input.path("content").get(0).path("data")).putNull("photoId");
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(input.toString())).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()))
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void durableContractDeclaresActualOperationNames() throws Exception {
        try (var stream = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<?, ?> document = new Yaml().load(stream);
            Map<?, ?> paths = (Map<?, ?>) document.get("paths");
            Map<?, ?> collection = (Map<?, ?>) paths.get("/api/resumes");
            assertThat(((Map<?, ?>) collection.get("get")).get("operationId")).isEqualTo("listResumes");
            assertThat(((Map<?, ?>) collection.get("post")).get("operationId")).isEqualTo("createResume");
        }
        mvc.perform(get("/api/resumes").with(user("jiwoo@resume.dev").roles())).andExpect(status().isOk());
    }

    @Test
    void listWithoutSessionIs401() throws Exception {
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void createWithoutSessionIs401() throws Exception {
        mvc.perform(post("/api/resumes")
            .contentType("application/json")
            .content("{\"title\":\"ok\",\"template\":\"classic\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void getWithoutSessionIs401() throws Exception {
        mvc.perform(get("/api/resumes/{id}", id)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void getForeignIs404WithoutWrite() throws Exception {
        rows.get(id).setUserId(other);
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void getDeletedIs404WithoutWrite() throws Exception {
        rows.get(id).setDeleted(true);
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void getMissingIs404WithoutWrite() throws Exception {
        id = UUID.randomUUID();
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void updateWithoutSessionIs401() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id)
            .contentType("application/json")
            .content(payload().toString()))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void updateForeignIs404WithoutWrite() throws Exception {
        rows.get(id).setUserId(other);
        mvc.perform(put("/api/resumes/{id}", id)
            .with(user("jiwoo@resume.dev").roles())
            .with(csrf())
            .contentType("application/json")
            .content(payload().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void updateDeletedIs404WithoutWrite() throws Exception {
        rows.get(id).setDeleted(true);
        mvc.perform(put("/api/resumes/{id}", id)
            .with(user("jiwoo@resume.dev").roles())
            .with(csrf())
            .contentType("application/json")
            .content(payload().toString()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void updateMissingIs404WithoutWrite() throws Exception {
        String validPayload = payload().toString();
        id = UUID.randomUUID();
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
                .contentType("application/json").content(validPayload))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void renameWithoutSessionIs401() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id)
            .contentType("application/json")
            .content("{\"title\":\"ok\",\"template\":\"classic\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void renameForeignIs404WithoutWrite() throws Exception {
        rows.get(id).setUserId(other);
        mvc.perform(patch("/api/resumes/{id}", id)
            .with(user("jiwoo@resume.dev").roles())
            .with(csrf())
            .contentType("application/json")
            .content("{\"title\":\"ok\",\"template\":\"classic\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void renameDeletedIs404WithoutWrite() throws Exception {
        rows.get(id).setDeleted(true);
        mvc.perform(patch("/api/resumes/{id}", id)
            .with(user("jiwoo@resume.dev").roles())
            .with(csrf())
            .contentType("application/json")
            .content("{\"title\":\"ok\",\"template\":\"classic\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void renameMissingIs404WithoutWrite() throws Exception {
        id = UUID.randomUUID();
        mvc.perform(patch("/api/resumes/{id}", id)
            .with(user("jiwoo@resume.dev").roles())
            .with(csrf())
            .contentType("application/json")
            .content("{\"title\":\"ok\",\"template\":\"classic\"}"))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void deleteWithoutSessionIs401() throws Exception {
        mvc.perform(delete("/api/resumes/{id}", id)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void deleteForeignIs404WithoutWrite() throws Exception {
        rows.get(id).setUserId(other);
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void deleteDeletedIs404WithoutWrite() throws Exception {
        rows.get(id).setDeleted(true);
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void deleteMissingIs404WithoutWrite() throws Exception {
        id = UUID.randomUUID();
        mvc.perform(delete("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void duplicateWithoutSessionIs401() throws Exception {
        mvc.perform(post("/api/resumes/{id}/duplicate", id)).andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("401"));
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
    }

    @Test
    void duplicateForeignIs404WithoutWrite() throws Exception {
        rows.get(id).setUserId(other);
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void duplicateDeletedIs404WithoutWrite() throws Exception {
        rows.get(id).setDeleted(true);
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void duplicateMissingIs404WithoutWrite() throws Exception {
        id = UUID.randomUUID();
        mvc.perform(post("/api/resumes/{id}/duplicate", id).with(user("jiwoo@resume.dev").roles()).with(csrf()))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any());
        verify(mapper, never()).update(any());
        verify(mapper, never()).rename(any());
        verify(mapper, never()).delete(any());
    }

    @Test
    void invalidCreateTemplateAddsNothing() throws Exception {
        mvc.perform(post("/api/resumes").with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content("{\"title\":\"ok\",\"template\":\"wrong\"}"))
            .andExpect(status().isBadRequest());
        verify(mapper, never()).insert(any());
    }

    @Test
    void whitespaceRenamePreservesTitle() throws Exception {
        mvc.perform(patch("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content("{\"title\":\"   \"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        assertThat(rows.get(id).getTitle()).isEqualTo("기존 제목");
        verify(mapper, never()).rename(any());
    }

    @Test
    void hiddenBasicsRejectsStructureWithoutWrite() throws Exception {
        ObjectNode input = payload();
        ((ObjectNode) input.path("content").get(0)).put("hidden", true);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(input.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verify(mapper, never()).update(any());
    }

    @Test
    void duplicateSectionRejectsStructureWithoutWrite() throws Exception {
        ObjectNode input = payload();
        ((com.fasterxml.jackson.databind.node.ArrayNode) input.get("content")).add(input.get("content").get(1));
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(input.toString())).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verify(mapper, never()).update(any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
        "unknown-type", "basics-order", "items-limit", "tags-limit", "links-limit",
        "field-type", "current-type", "degree", "hex", "font", "size", "managed-owner"
    })
    void invalidStructurePreservesSnapshot(String rule) throws Exception {
        Resume before = copy(rows.get(id));
        ObjectNode input = payload();
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) input.get("content");
        var basics = (ObjectNode) content.get(0).get("data");
        var style = (ObjectNode) input.get("style");
        switch (rule) {
            case "unknown-type" -> ((ObjectNode) content.get(1)).put("type", "unknown");
            case "basics-order" -> {
                var first = content.remove(0);
                content.add(first);
            }
            case "items-limit" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).get("items");
                for (int index = 0; index < 21; index++) items.addObject().put("company", "");
            }
            case "tags-limit" -> {
                var tags = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(4).get("data").get("tags");
                for (int index = 0; index < 31; index++) tags.add("tag" + index);
            }
            case "links-limit" -> {
                var links = (com.fasterxml.jackson.databind.node.ArrayNode) basics.get("links");
                for (int index = 0; index < 4; index++) links.addObject().put("url", "");
            }
            case "field-type" -> basics.put("email", 7);
            case "current-type" -> ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(2).get("items"))
                .addObject().put("current", "true");
            case "degree" -> ((com.fasterxml.jackson.databind.node.ArrayNode) content.get(3).get("items"))
                .addObject().put("degree", "invalid");
            case "hex" -> style.put("color", "red");
            case "font" -> style.put("font", "invalid");
            case "size" -> style.put("size", "12pt");
            case "managed-owner" -> input.put("user_id", other.toString());
            default -> throw new IllegalArgumentException(rule);
        }
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
                .contentType("application/json").content(input.toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verify(mapper, never()).update(any());
        assertThat(rows.get(id).getContent()).isEqualTo(before.getContent());
        assertThat(rows.get(id).getStyle()).isEqualTo(before.getStyle());
    }

    @Test
    void warningOnlyDatesAndCustomHexPersistExactly() throws Exception {
        ObjectNode input = payload();
        ((ObjectNode) input.get("style")).put("color", "#Ab12F0");
        var items = (com.fasterxml.jackson.databind.node.ArrayNode) input.get("content").get(2).get("items");
        items.addObject().put("company", "").put("start", "2025.01").put("end", "2020.01")
            .put("current", false);
        items.addObject().put("company", "").put("start", "bad").put("end", "anything");
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
                .contentType("application/json").content(input.toString()))
            .andExpect(status().isOk());
        mvc.perform(get("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()))
            .andExpect(jsonPath("$.data.style.color").value("#Ab12F0"))
            .andExpect(jsonPath("$.data.content[2].items[0].end").value("2020.01"))
            .andExpect(jsonPath("$.data.content[2].items[1].start").value("bad"));
    }

    @Test
    void exactDecimalPayloadLimitIsAccepted() throws Exception {
        String body = payload().toString();
        byte[] bytes = (body + " ".repeat(200000 - body.getBytes(java.nio.charset.StandardCharsets.UTF_8).length))
            .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(bytes).hasSize(200000);
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
                .contentType("application/json").content(bytes))
            .andExpect(status().isOk());
        verify(mapper).update(any());
    }

    @Test
    void authenticatedMutationWithoutCsrfIs403WithoutWrite() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles())
                .contentType("application/json").content(payload().toString()))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("403"));
        verify(mapper, never()).update(any());
    }

    @Test
    void rawPayloadOverDecimalLimitIs413WithoutWrite() throws Exception {
        mvc.perform(put("/api/resumes/{id}", id).with(user("jiwoo@resume.dev").roles()).with(csrf())
            .contentType("application/json").content(" ".repeat(200001))).andExpect(status().isPayloadTooLarge())
            .andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, never()).update(any());
    }
}
