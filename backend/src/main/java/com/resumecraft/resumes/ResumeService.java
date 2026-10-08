package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiException;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import com.resumecraft.common.persistence.ResumeRow;
import com.resumecraft.common.persistence.UserMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 자기 활성 이력서에 대한 조회와 원자적 명령을 조정한다. 사진 row의 수명은 변경하지 않는다. */
@Service
public class ResumeService {
    private final ResumeMapper resumes;
    private final UserMapper users;
    private final PhotoMapper photos;
    private final ObjectMapper json;
    private final ResumeStructureValidator validator;

    public ResumeService(
            ResumeMapper resumes,
            UserMapper users,
            PhotoMapper photos,
            ObjectMapper json,
            ResumeStructureValidator validator) {
        this.resumes = resumes;
        this.users = users;
        this.photos = photos;
        this.json = json;
        this.validator = validator;
    }

    /** 저장 row에서 서버 소유 필드를 제거한 OpenAPI 투영. */
    public record Resume(
            UUID id, String title, String template, JsonNode style, JsonNode content, Instant updated_at) {
    }

    @Transactional(readOnly = true)
    public ApiResponse<List<Resume>> list(UUID userId, int page, int size, String filter) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "페이지 범위를 확인해주세요.", "page");
        }
        String pattern = filter == null || filter.trim().isEmpty() ? null
                : "%" + filter.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new ApiResponse<>(true,
                Map.of("page", page, "size", size, "total", resumes.countOwnedActive(userId, pattern)),
                resumes.listOwnedActive(userId, pattern, size, (long) page * size).stream()
                        .map(this::view).toList());
    }

    @Transactional(readOnly = true)
    public Resume get(UUID id, UUID userId) {
        return view(owned(id, userId));
    }

    /** 이메일은 인증 사용자 원천으로부터 읽고 기본 본문을 서버에서 초기화한다. */
    @Transactional
    public UUID create(UUID userId, JsonNode input) {
        String title = title(input);
        validator.template(input.get("template"));
        var user = users.findById(userId);
        if (user == null) throw missing();
        var content = json.createArrayNode();
        var basics = content.addObject();
        basics.put("type", "basics").put("hidden", false);
        var data = basics.putObject("data");
        data.put("name", "").put("jobTitle", "").put("email", user.email()).put("phone", "");
        data.putArray("links");
        data.putNull("photoId");
        for (String type : List.of("summary", "experience", "education", "skills")) {
            var section = content.addObject().put("type", type).put("hidden", false);
            if ("summary".equals(type)) section.putObject("data").put("headline", "").put("body", "");
            else if ("skills".equals(type)) section.putObject("data").putArray("tags");
            else section.putArray("items");
        }
        var style = json.createObjectNode().put("color", "#1F3A5F")
                .put("font", "pretendard").put("size", "medium");
        Instant now = Instant.now();
        UUID id = UUID.randomUUID();
        resumes.insert(new ResumeRow(id, userId, title, input.get("template").asText(),
                style, content, false, now, now));
        return id;
    }

    /** 전체 UTF-8 JSON byte 상한과 사진 소유권을 모두 검사한 다음 한 row를 교체한다. */
    @Transactional
    public void update(UUID id, UUID userId, JsonNode input) {
        var previous = owned(id, userId);
        try {
            if (json.writeValueAsBytes(input).length > 200_000) {
                throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE",
                        "이력서는 200KB 이하만 가능합니다.", null);
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "잘못된 요청입니다.", null);
        }
        validator.validate(input);
        String newTitle = input.has("title") ? title(input) : previous.title();
        JsonNode photoId = input.path("content").get(0).path("data").get("photoId");
        if (photoId != null && !photoId.isNull()
                && photos.findOwned(UUID.fromString(photoId.asText()), userId) == null) throw missing();
        int count = resumes.updateOwnedActive(new ResumeRow(id, userId, newTitle, input.get("template").asText(),
                input.get("style"), input.get("content"), false, previous.createdAt(), Instant.now()));
        if (count != 1) throw missing();
    }

    /** PATCH는 제목만 변경하고 본문/표현/소유권을 보존한다. */
    @Transactional
    public void rename(UUID id, UUID userId, JsonNode input) {
        owned(id, userId);
        if (resumes.renameOwnedActive(id, userId, title(input)) != 1) throw missing();
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        if (resumes.deleteOwnedActive(id, userId) != 1) throw missing();
    }

    /** 새 이력서 id만 발급하며 본문 항목 id와 본인 사진 참조를 그대로 보존한다. */
    @Transactional
    public UUID duplicate(UUID id, UUID userId) {
        var original = owned(id, userId);
        UUID copyId = UUID.randomUUID();
        Instant now = Instant.now();
        resumes.insert(new ResumeRow(copyId, userId, original.title() + " (사본)", original.template(),
                original.style().deepCopy(), original.content().deepCopy(), false, now, now));
        return copyId;
    }

    private String title(JsonNode input) {
        if (input == null || !input.isObject() || !input.path("title").isTextual()
                || input.path("title").asText().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", "제목을 입력해주세요.", "title");
        }
        return input.get("title").asText().trim();
    }

    private ResumeRow owned(UUID id, UUID userId) {
        var row = resumes.findOwnedActive(id, userId);
        if (row == null) throw missing();
        return row;
    }

    private Resume view(ResumeRow row) {
        return new Resume(row.id(), row.title(), row.template(), row.style(), row.content(), row.updatedAt());
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "이력서를 찾을 수 없습니다.", null);
    }
}
