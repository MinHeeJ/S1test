package com.resumecraft.photos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiExceptionHandler;
import com.resumecraft.resumes.ResumeController;
import com.resumecraft.resumes.ResumeMapper;
import com.resumecraft.resumes.ResumeRecord;
import com.resumecraft.resumes.ResumeService;
import com.resumecraft.resumes.ResumeStructureValidator;
import com.resumecraft.resumes.ResumeWrite;
import com.resumecraft.security.SecurityConfig;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({PhotoController.class, ResumeController.class})
@Import({SecurityConfig.class, ApiExceptionHandler.class, PhotoService.class,
    ResumeService.class, ResumeStructureValidator.class})
class PhotoIntegrationTest {
    static final UUID OWNER = UUID.fromString("10000000-0000-4000-8000-000000000001");
    static final UUID OTHER = UUID.fromString("10000000-0000-4000-8000-000000000002");
    static final OffsetDateTime INITIAL_UPDATED_AT = OffsetDateTime.parse("2026-01-01T00:00:00Z");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PhotoMapper mapper;
    @MockBean ResumeMapper resumeMapper;
    final Map<UUID, PhotoRecord> rows = new HashMap<>();
    final Map<UUID, ResumeRecord> resumes = new HashMap<>();

    @BeforeEach
    void persistenceBoundary() {
        rows.clear();
        resumes.clear();
        when(mapper.insert(any())).thenAnswer(call -> {
            PhotoRecord row = call.getArgument(0);
            rows.put(row.id(), row);
            return 1;
        });
        when(mapper.findOwned(any(), any())).thenAnswer(call -> {
            PhotoRecord row = rows.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1)) ? row : null;
        });
        when(resumeMapper.email(OWNER)).thenReturn("owner@example.com");
        when(resumeMapper.insert(any(), any(), any())).thenAnswer(call -> {
            UUID id = call.getArgument(0);
            ResumeWrite write = call.getArgument(2);
            if (!OWNER.equals(call.getArgument(1))) {
                return 0;
            }
            resumes.put(id, new ResumeRecord(id, write.title(), write.template(),
                write.style().deepCopy(), write.content().deepCopy(), INITIAL_UPDATED_AT));
            return 1;
        });
        when(resumeMapper.find(any(), any())).thenAnswer(call ->
            OWNER.equals(call.getArgument(1)) ? resumes.get(call.getArgument(0)) : null);
        when(resumeMapper.ownsPhoto(any(), any())).thenAnswer(call -> {
            PhotoRecord row = rows.get(call.getArgument(0));
            return row != null && row.userId().equals(call.getArgument(1));
        });
        when(resumeMapper.save(any(), any(), any())).thenAnswer(call -> {
            UUID id = call.getArgument(0);
            ResumeWrite write = call.getArgument(2);
            if (!OWNER.equals(call.getArgument(1)) || !resumes.containsKey(id)) {
                return 0;
            }
            resumes.put(id, new ResumeRecord(id, write.title(), write.template(),
                write.style().deepCopy(), write.content().deepCopy(), INITIAL_UPDATED_AT.plusSeconds(1)));
            return 1;
        });
    }

    static byte[] image(String format) throws Exception {
        var output = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB), format, output);
        return output.toByteArray();
    }

    private static RequestPostProcessor asMultipart(MockMultipartFile... files) {
        return request -> {
            var multipart = new MockMultipartHttpServletRequest(request.getServletContext());
            multipart.setMethod(request.getMethod());
            multipart.setRequestURI(request.getRequestURI());
            multipart.setServletPath(request.getServletPath());
            multipart.setPathInfo(request.getPathInfo());
            multipart.setQueryString(request.getQueryString());
            multipart.setCharacterEncoding(request.getCharacterEncoding());
            multipart.setSession(request.getSession(false));
            request.getParameterMap().forEach(multipart::addParameter);
            var attributes = request.getAttributeNames();
            while (attributes.hasMoreElements()) {
                String name = attributes.nextElement();
                multipart.setAttribute(name, request.getAttribute(name));
            }
            var headers = request.getHeaderNames();
            while (headers.hasMoreElements()) {
                String name = headers.nextElement();
                var values = request.getHeaders(name);
                while (values.hasMoreElements()) {
                    multipart.addHeader(name, values.nextElement());
                }
            }
            for (MockMultipartFile file : files) {
                multipart.addFile(file);
            }
            multipart.setContentType("multipart/form-data");
            return multipart;
        };
    }

    private UUID upload(byte[] bytes, String mime) throws Exception {
        var file = new MockMultipartFile("file", "photo", mime, bytes);
        var result = mvc.perform(post("/api/photos").with(asMultipart(file))
                .with(user(OWNER.toString())).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.photoId").isString()).andReturn();
        return UUID.fromString(json.readTree(result.getResponse().getContentAsString()).at("/data/photoId").asText());
    }

    @Test
    @DisplayName("[business] JPEG 업로드 후 소유자 다운로드는 원본 바이트와 MIME을 유지한다")
    void jpegUploadThenOwnerDownloadReturnsExactBytes() throws Exception {
        byte[] bytes = image("jpeg");
        UUID id = upload(bytes, "image/jpeg");
        mvc.perform(get("/api/photos/{id}", id).with(user(OWNER.toString())))
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/jpeg"))
            .andExpect(content().bytes(bytes))
            .andExpect(header().string("Cache-Control", "no-store"));
        assertThat(rows.get(id).userId()).as("user_id").isEqualTo(OWNER);
        assertThat(rows.get(id).contentType()).as("content_type").isEqualTo("image/jpeg");
        assertThat(rows.get(id).data()).isEqualTo(bytes);
        verify(mapper, times(1)).insert(any());
    }

    @Test
    @DisplayName("[business] PNG 업로드는 원본 bytea와 인증된 user_id를 저장한다")
    void pngUploadKeepsOriginalByteaAndDeclaredContentType() throws Exception {
        byte[] bytes = image("png");
        UUID id = upload(bytes, "image/png");
        assertThat(rows.get(id).data()).isEqualTo(bytes);
        assertThat(rows.get(id).contentType()).as("content_type").isEqualTo("image/png");
        assertThat(rows.get(id).userId()).as("user_id").isEqualTo(OWNER);
        mvc.perform(get("/api/photos/{id}", id).with(user(OWNER.toString())))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png"))
            .andExpect(content().bytes(bytes));
    }

    @Test
    @DisplayName("[validation] 정확히 2,000,000바이트인 JPEG는 잘리지 않고 저장된다")
    void exactTwoMillionBytesAreAccepted() throws Exception {
        byte[] bytes = Arrays.copyOf(image("jpeg"), 2_000_000);
        UUID id = upload(bytes, "image/jpeg");
        assertThat(rows.get(id).data()).hasSize(2_000_000).isEqualTo(bytes);
    }

    @Test
    @DisplayName("[auth] 익명 POST는 CSRF 검사보다 먼저 401로 거절되고 저장하지 않는다")
    void anonymousUploadIs401BeforeCsrfAndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.png", "image/png", image("png"));
        mvc.perform(post("/api/photos").with(asMultipart(file)))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        assertThat(rows).isEmpty();
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[auth] 익명 GET은 사진 저장소를 조회하지 않고 401을 반환한다")
    void anonymousGetIs401() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[auth] 인증된 POST도 CSRF 토큰이 없으면 403이며 저장하지 않는다")
    void authenticatedUploadWithoutCsrfIs403AndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.png", "image/png", image("png"));
        mvc.perform(post("/api/photos").with(asMultipart(file)).with(user(OWNER.toString())))
            .andExpect(status().isForbidden());
        assertThat(rows).isEmpty();
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[business] 타인 사진 GET은 404이며 기존 사진을 변경하지 않는다")
    void foreignPhotoIs404WithoutExposingBytesOrMutatingRows() throws Exception {
        byte[] bytes = image("png");
        UUID id = upload(bytes, "image/png");
        mvc.perform(get("/api/photos/{id}", id).with(user(OTHER.toString())))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.field").value(org.hamcrest.Matchers.nullValue()));
        assertThat(rows).hasSize(1);
        assertThat(rows.get(id).data()).isEqualTo(bytes);
        assertThat(rows.get(id).userId()).isEqualTo(OWNER);
        verify(mapper, times(1)).insert(any());
    }

    @Test
    @DisplayName("[business] 존재하지 않는 사진 GET은 404이며 새 사진을 만들지 않는다")
    void missingPhotoIs404() throws Exception {
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user(OWNER.toString())))
            .andExpect(status().isNotFound()).andExpect(jsonPath("$.success").value(false));
        verify(mapper, never()).insert(any());
    }

    @Test
    @DisplayName("[business] 지원하지 않는 GIF POST는 UNSUPPORTED_FILE_TYPE이며 저장하지 않는다")
    void gifUploadIsUnsupportedAndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.gif", "image/gif", image("gif"));
        rejected(post("/api/photos").with(asMultipart(file)), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    @DisplayName("[validation] PNG를 JPEG MIME으로 위장한 POST는 저장하지 않는다")
    void mimeSpoofedPngIsUnsupportedAndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", image("png"));
        rejected(post("/api/photos").with(asMultipart(file)), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    @DisplayName("[validation] 이미지로 디코딩할 수 없는 POST는 저장하지 않는다")
    void corruptImageIsUnsupportedAndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.png", "image/png", new byte[]{1, 2, 3});
        rejected(post("/api/photos").with(asMultipart(file)), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    @DisplayName("[validation] 빈 파일 POST는 file 오류이며 저장하지 않는다")
    void emptyFileIsUnsupportedAndDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.png", "image/png", new byte[0]);
        rejected(post("/api/photos").with(asMultipart(file)), 400, "UNSUPPORTED_FILE_TYPE");
    }

    @Test
    @DisplayName("[validation] 2,000,001바이트 POST는 413이며 저장하지 않는다")
    void oversizedUploadDoesNotInsert() throws Exception {
        var file = new MockMultipartFile("file", "photo.jpg", "image/jpeg",
            Arrays.copyOf(image("jpeg"), 2_000_001));
        rejected(post("/api/photos").with(asMultipart(file)), 413, "FILE_TOO_LARGE");
    }

    @Test
    @DisplayName("[validation] file 파트가 없는 POST는 400과 file 필드를 반환한다")
    void missingFileIs400WithFileField() throws Exception {
        mvc.perform(post("/api/photos").with(asMultipart()).with(user(OWNER.toString())).with(csrf()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("file"))
            .andExpect(jsonPath("$.success").value(false));
        assertThat(rows).isEmpty();
        verifyNoInteractions(mapper);
    }

    private void rejected(MockHttpServletRequestBuilder request, int statusCode, String code) throws Exception {
        mvc.perform(request.with(user(OWNER.toString())).with(csrf()))
            .andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
            .andExpect(jsonPath("$.field").value("file")).andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.success").value(false));
        assertThat(rows).isEmpty();
        verifyNoInteractions(mapper);
    }

    @Test
    @DisplayName("[business] 교체 사진 POST 실패는 기존 사진을 삭제하거나 덮어쓰지 않는다")
    void rejectedReplacementPreservesExistingPhoto() throws Exception {
        byte[] original = image("png");
        UUID id = upload(original, "image/png");
        var file = new MockMultipartFile("file", "replacement.gif", "image/gif", image("gif"));
        mvc.perform(post("/api/photos").with(asMultipart(file)).with(user(OWNER.toString())).with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"))
            .andExpect(jsonPath("$.field").value("file"));
        assertThat(rows).hasSize(1);
        mvc.perform(get("/api/photos/{id}", id).with(user(OWNER.toString())))
            .andExpect(status().isOk()).andExpect(content().bytes(original));
        verify(mapper, times(1)).insert(any());
    }

    @Test
    @DisplayName("happy/side-effect/state: photo metadata, created_at DB default; resume changes only after PUT")
    void uploadDoesNotLinkResumeUntilSeparatePut() throws Exception {
        var created = mvc.perform(post("/api/resumes").with(user(OWNER.toString())).with(csrf())
                .contentType("application/json").content("{\"template\":\"classic\"}"))
            .andExpect(status().isCreated()).andReturn();
        UUID resumeId = UUID.fromString(json.readTree(created.getResponse().getContentAsString())
            .at("/data/id").asText());
        var initial = mvc.perform(get("/api/resumes/{id}", resumeId).with(user(OWNER.toString())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(org.hamcrest.Matchers.nullValue()))
            .andReturn();
        var beforeUpload = json.readTree(initial.getResponse().getContentAsString()).get("data");
        byte[] uploadedBytes = image("png");
        var file = new MockMultipartFile("file", "photo.png", "image/png", uploadedBytes);
        var uploaded = mvc.perform(post("/api/photos").with(asMultipart(file))
                .with(user(OWNER.toString())).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.meta").isMap())
            .andExpect(jsonPath("$.data.photoId").isString()).andReturn();
        UUID photoId = UUID.fromString(json.readTree(uploaded.getResponse().getContentAsString())
            .at("/data/photoId").asText());
        assertThat(rows.get(photoId).data()).isEqualTo(uploadedBytes);
        assertThat(rows.get(photoId).userId()).as("user_id").isEqualTo(OWNER);
        assertThat(rows.get(photoId).contentType()).as("content_type").isEqualTo("image/png");
        assertPhotoCreatedAtSchemaDefault();
        var unchanged = mvc.perform(get("/api/resumes/{id}", resumeId).with(user(OWNER.toString())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(org.hamcrest.Matchers.nullValue()))
            .andReturn();
        assertThat(json.readTree(unchanged.getResponse().getContentAsString()).get("data"))
            .as("POST alone preserves resume content, style, title and updated_at").isEqualTo(beforeUpload);
        verify(resumeMapper, never()).save(any(), any(), any());

        ObjectNode request = ((ObjectNode) beforeUpload).deepCopy();
        ((ObjectNode) request.at("/content/0/data")).put("photoId", photoId.toString());
        mvc.perform(put("/api/resumes/{id}", resumeId).with(user(OWNER.toString())).with(csrf())
                .contentType("application/json").content(json.writeValueAsBytes(request)))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/resumes/{id}", resumeId).with(user(OWNER.toString())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].data.photoId").value(photoId.toString()));
        verify(resumeMapper).ownsPhoto(photoId, OWNER);
        verify(resumeMapper, times(1)).save(eq(resumeId), eq(OWNER), any());
        assertThat(rows.get(photoId).userId()).isEqualTo(OWNER);
    }

    @Test
    @DisplayName("[persistence-contract] photo INSERT는 user_id와 content_type을 바인딩하고 created_at은 DB 기본값이다")
    void photoSqlBindsMetadataAndLeavesCreatedAtToDatabaseDefault() throws Exception {
        assertPhotoCreatedAtSchemaDefault();
    }

    private void assertPhotoCreatedAtSchemaDefault() throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        try (var input = new ClassPathResource("mappers/PhotoMapper.xml").getInputStream()) {
            var document = factory.newDocumentBuilder().parse(input);
            String insert = XPathFactory.newInstance().newXPath()
                .evaluate("/mapper/insert[@id='insert']", document).replaceAll("\\s+", " ").trim();
            assertThat(insert).contains("INSERT INTO photo (id, user_id, content_type, data)");
            assertThat(insert).contains("#{userId}", "#{contentType}").doesNotContain("created_at");
        }
        try (var input = new ClassPathResource("db/migration/V1__resume_foundation.sql").getInputStream()) {
            String migration = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            var photoTable = java.util.regex.Pattern.compile(
                "(?is)CREATE TABLE IF NOT EXISTS photo\\s*\\((.*?)\\);"
            ).matcher(migration);
            assertThat(photoTable.find()).as("photo table exists in the actual migration").isTrue();
            assertThat(photoTable.group(1)).as("created_at is database-generated, not fabricated by this MVC test")
                .containsPattern("(?i)created_at\\s+timestamptz\\s+NOT NULL\\s+DEFAULT CURRENT_TIMESTAMP");
        }
    }

    @Test
    @DisplayName("[error] 저장소 오류는 500이며 SQL 내부 정보를 응답에 노출하지 않는다")
    void unexpectedPersistenceFailureDoesNotLeakDetails() throws Exception {
        when(mapper.findOwned(any(), any())).thenThrow(new IllegalStateException("secret SQL photo.data"));
        mvc.perform(get("/api/photos/{id}", UUID.randomUUID()).with(user(OWNER.toString())))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
            .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret"))));
    }

    @Test
    @DisplayName("[contract] OpenAPI 업로드와 다운로드 operationId는 구현된 사진 API와 일치한다")
    void durableContractHasBothImplementedOperationIds() throws Exception {
        var options = new LoaderOptions();
        options.setMaxAliasesForCollections(10000);
        try (var input = new ClassPathResource("contracts/openapi.yaml").getInputStream()) {
            Map<?, ?> document = new Yaml(new SafeConstructor(options)).load(input);
            Map<?, ?> paths = (Map<?, ?>) document.get("paths");
            Map<?, ?> upload = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos")).get("post");
            Map<?, ?> download = (Map<?, ?>) ((Map<?, ?>) paths.get("/api/photos/{id}")).get("get");
            assertThat(upload.get("operationId")).isEqualTo("uploadPhoto");
            assertThat(download.get("operationId")).isEqualTo("getPhoto");
        }
    }
}
