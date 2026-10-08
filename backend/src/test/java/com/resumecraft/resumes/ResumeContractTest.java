package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.*;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ResumeController.class)
@Import({SecurityConfig.class, ApiErrorHandler.class, ResumeService.class, ResumeStructureValidator.class})
class ResumeContractTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResumeMapper mapper;
    final UUID owner = UUID.randomUUID();
    final UUID id = UUID.randomUUID();
    final SessionUser user = new SessionUser(owner, "jiwoo@resume.dev", "지우");
    ResumeDocument original;
    ObjectNode input;

    @BeforeEach
    void setup() throws Exception {
        input = (ObjectNode) json.readTree("""
                {"template":"classic","style":{"color":"#1F3A5F","font":"pretendard","size":"medium"},
                 "content":[{"type":"basics","hidden":false,"data":{"name":"","jobTitle":"","email":"abc@",
                 "photoId":null}},{"type":"experience","hidden":true,"items":[{"id":"kept","company":"",
                 "start":"wrong","end":"2020.01","current":true,"description":"draft"}]}]}
                """);
        original = new ResumeDocument(id, "원본", "classic", input.get("style"), input.get("content"), "2026-01-01");
        when(mapper.find(id, owner)).thenReturn(original);
        when(mapper.lock(id, owner)).thenReturn(original);
        when(mapper.update(eq(id), eq(owner), any(), anyString(), any(), any())).thenReturn(1);
        when(mapper.rename(eq(id), eq(owner), anyString())).thenReturn(1);
        when(mapper.delete(id, owner)).thenReturn(1);
    }

    MockHttpServletRequestBuilder signed(MockHttpServletRequestBuilder request) {
        return request.with(authentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of())))
                .with(csrf());
    }

    @Test
    void fixtureAndOwnerReadProjection() throws Exception {
        assertThat(new ClassPathResource("contracts/openapi.yaml").exists()).isTrue();
        mvc.perform(signed(get("/api/resumes/{id}", id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(id.toString()))
                .andExpect(jsonPath("$.data.updated_at").value("2026-01-01"))
                .andExpect(jsonPath("$.data.user_id").doesNotExist()).andExpect(jsonPath("$.meta").isEmpty());
    }

    @Test
    void listBindsScopePaginationAndFilter() throws Exception {
        when(mapper.list(owner, "BACK", 2, 2L)).thenReturn(List.of(original));
        mvc.perform(signed(get("/api/resumes?page=1&size=2&filter=BACK")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].title").value("원본"));
        verify(mapper).list(owner, "BACK", 2, 2L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101"})
    void rejectsInvalidPagination(String query) throws Exception {
        mvc.perform(signed(get("/api/resumes?" + query))).andExpect(status().isBadRequest());
        verify(mapper, never()).list(any(), any(), anyInt(), anyLong());
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "POST", "PUT", "PATCH", "DELETE", "DUPLICATE", "LIST"})
    void allOperationsRequireSession(String operation) throws Exception {
        mvc.perform(operation(operation, id.toString()).contentType("application/json").content(input.toString()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        verifyNoInteractions(mapper);
    }

    @Test
    void createUsesAuthenticatedEmailAndEmptyDefaults() throws Exception {
        mvc.perform(signed(post("/api/resumes")).contentType("application/json")
                .content("{\"title\":\" 새 이력서 \" ,\"template\":\"modern\",\"user_id\":\"ignored\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString());
        var content = org.mockito.ArgumentCaptor.forClass(com.fasterxml.jackson.databind.JsonNode.class);
        verify(mapper).insert(any(UUID.class), eq(owner), eq("새 이력서"), eq("modern"), any(), content.capture());
        assertThat(content.getValue().size()).isEqualTo(5);
        assertThat(content.getValue().get(0).path("data").path("email").asText()).isEqualTo(user.email());
        assertThat(content.getValue().get(0).path("data").path("photoId").isNull()).isTrue();
    }

    @Test
    void invalidCreateHasNoInsert() throws Exception {
        mvc.perform(signed(post("/api/resumes")).contentType("application/json")
                .content("{\"title\":\"title\",\"template\":\"invalid\"}"))
                .andExpect(status().isBadRequest());
        verify(mapper, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "PUT", "PATCH", "DELETE", "DUPLICATE"})
    void missingForeignAndDeletedAreIndistinguishable(String operation) throws Exception {
        mvc.perform(signed(operation(operation, UUID.randomUUID().toString()))
                .contentType("application/json").content(input.toString()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test
    void draftWarningsDoNotBlockSaveAndOmittedTitleIsPreserved() throws Exception {
        mvc.perform(signed(put("/api/resumes/{id}", id)).contentType("application/json").content(input.toString()))
                .andExpect(status().isOk()).andExpect(content().json("{\"success\":true,\"meta\":{}}", true));
        verify(mapper).update(id, owner, null, "classic", input.get("style"), input.get("content"));
        mvc.perform(signed(get("/api/resumes/{id}", id)))
                .andExpect(jsonPath("$.data.content[0].data.email").value("abc@"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"duplicate", "hidden", "type", "color", "font", "size", "current", "links", "tags",
            "items", "degree", "string"})
    void structuralErrorsDoNotWrite(String violation) throws Exception {
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) input.get("content");
        var basics = (ObjectNode) content.get(0);
        switch (violation) {
            case "duplicate" -> content.add(basics.deepCopy());
            case "hidden" -> basics.put("hidden", true);
            case "type" -> basics.put("type", "other");
            case "color", "font", "size" -> ((ObjectNode) input.get("style")).put(violation, "invalid");
            case "current" -> ((ObjectNode) content.get(1).get("items").get(0)).put("current", "true");
            case "links" -> {
                var links = ((ObjectNode) basics.get("data")).putArray("links");
                for (int n = 0; n < 4; n++) links.addObject();
            }
            case "tags" -> {
                var tags = content.addObject().put("type", "skills").put("hidden", false)
                        .putObject("data").putArray("tags");
                for (int n = 0; n < 31; n++) tags.add("tag");
            }
            case "items" -> {
                var items = (com.fasterxml.jackson.databind.node.ArrayNode) content.get(1).get("items");
                while (items.size() < 21) items.addObject();
            }
            case "degree" -> content.addObject().put("type", "education").put("hidden", false)
                    .putArray("items").addObject().put("degree", "other");
            case "string" -> ((ObjectNode) basics.get("data")).put("name", 123);
            default -> throw new AssertionError();
        }
        mvc.perform(signed(put("/api/resumes/{id}", id)).contentType("application/json").content(input.toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_STRUCTURE"));
        verify(mapper, never()).update(any(), any(), any(), any(), any(), any());
    }

    @Test
    void utf8LimitIncludesEntireInput() throws Exception {
        input.put("extra", "가".repeat(70000));
        mvc.perform(signed(put("/api/resumes/{id}", id)).contentType("application/json").content(input.toString()))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("CONTENT_TOO_LARGE"));
        verify(mapper, never()).update(any(), any(), any(), any(), any(), any());
    }

    @Test
    void nonOwnedPhotoCannotBeLinked() throws Exception {
        ((ObjectNode) input.get("content").get(0).get("data")).put("photoId", UUID.randomUUID().toString());
        mvc.perform(signed(put("/api/resumes/{id}", id)).contentType("application/json").content(input.toString()))
                .andExpect(status().isNotFound());
        verify(mapper, never()).update(any(), any(), any(), any(), any(), any());
    }

    @Test
    void renameTouchesOnlyTitleAndTrims() throws Exception {
        mvc.perform(signed(patch("/api/resumes/{id}", id)).contentType("application/json")
                .content("{\"title\":\" 새 제목 \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        verify(mapper).rename(id, owner, "새 제목");
        verify(mapper, never()).update(any(), any(), any(), any(), any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  "})
    void blankRenameKeepsOriginal(String title) throws Exception {
        mvc.perform(signed(patch("/api/resumes/{id}", id)).contentType("application/json")
                .content(json.createObjectNode().put("title", title).toString()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("title"));
        verify(mapper, never()).rename(any(), any(), any());
    }

    @Test
    void duplicatePreservesContentStyleAndInternalIds() throws Exception {
        mvc.perform(signed(post("/api/resumes/{id}/duplicate", id)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.id").isString());
        verify(mapper).insert(argThat(key -> !key.equals(id)), eq(owner), eq("원본 (사본)"), eq("classic"),
                eq(original.style()), eq(original.content()));
    }

    @Test
    void deletionUsesSoftDeleteAdapter() throws Exception {
        mvc.perform(signed(delete("/api/resumes/{id}", id))).andExpect(status().isOk());
        verify(mapper).delete(id, owner);
    }

    private MockHttpServletRequestBuilder operation(String operation, String key) {
        String path = "/api/resumes/" + key;
        return switch (operation) {
            case "GET" -> get(path);
            case "POST" -> post("/api/resumes");
            case "PUT" -> put(path);
            case "PATCH" -> patch(path);
            case "DELETE" -> delete(path);
            case "DUPLICATE" -> post(path + "/duplicate");
            case "LIST" -> get("/api/resumes");
            default -> throw new AssertionError();
        };
    }
}
