package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Orchestrates draft persistence with ownership and active-state checks inside each write transaction. */
@Service
public class ResumeService {
    private final ResumeMapper mapper;
    private final ResumeStructureValidator validator;
    private final ObjectMapper json;

    public ResumeService(ResumeMapper mapper, ResumeStructureValidator validator, ObjectMapper json) {
        this.mapper = mapper;
        this.validator = validator;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<ResumeDocument> list(SessionUser user, int page, int size, String filter) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "페이지 범위를 확인해 주세요.", null);
        }
        return mapper.list(user.id(), filter, size, (long) page * size);
    }

    @Transactional(readOnly = true)
    public ResumeDocument get(SessionUser user, String id) {
        return require(mapper.find(identifier(id), user.id()));
    }

    /** Creates just the five empty initial sections; signup email is obtained from the authenticated identity. */
    @Transactional
    public UUID create(SessionUser user, JsonNode input) {
        String title = validator.title(input.get("title"));
        validator.template(input.get("template"));
        ArrayNode content = json.createArrayNode();
        var basics = content.addObject().put("type", "basics").put("hidden", false).putObject("data");
        basics.put("name", "").put("jobTitle", "").put("email", user.email()).put("phone", "").putNull("photoId");
        basics.putArray("links");
        content.addObject().put("type", "summary").put("hidden", false).putObject("data")
                .put("headline", "").put("body", "");
        for (String type : List.of("experience", "education")) {
            content.addObject().put("type", type).put("hidden", false).putArray("items");
        }
        content.addObject().put("type", "skills").put("hidden", false).putObject("data").putArray("tags");
        var style = json.createObjectNode().put("color", "#1F3A5F").put("font", "pretendard").put("size", "medium");
        UUID id = UUID.randomUUID();
        mapper.insert(id, user.id(), title, input.get("template").asText(), style, content);
        return id;
    }

    /** Replaces the draft without upsert, preserving an omitted title and never deleting photo bytes. */
    @Transactional
    public void update(SessionUser user, String id, JsonNode input) {
        UUID key = identifier(id);
        require(mapper.lock(key, user.id()));
        validator.validate(input);
        String title = input.has("title") ? validator.title(input.get("title")) : null;
        JsonNode photo = input.path("content").get(0).path("data").path("photoId");
        if (!photo.isMissingNode() && !photo.isNull()) {
            if (!mapper.ownsPhoto(identifier(photo.asText()), user.id())) throw missing();
        }
        requireChanged(mapper.update(key, user.id(), title, input.get("template").asText(),
                input.get("style"), input.get("content")));
    }

    @Transactional
    public void rename(SessionUser user, String id, JsonNode input) {
        UUID key = identifier(id);
        require(mapper.lock(key, user.id()));
        requireChanged(mapper.rename(key, user.id(), validator.title(input.get("title"))));
    }

    @Transactional
    public void delete(SessionUser user, String id) {
        requireChanged(mapper.delete(identifier(id), user.id()));
    }

    /** Only the resume UUID changes: internal item IDs and owned photo references remain identical. */
    @Transactional
    public UUID duplicate(SessionUser user, String id) {
        var source = require(mapper.lock(identifier(id), user.id()));
        UUID copy = UUID.randomUUID();
        mapper.insert(copy, user.id(), source.title() + " (사본)", source.template(), source.style(), source.content());
        return copy;
    }

    private ResumeDocument require(ResumeDocument document) {
        if (document == null) throw missing();
        return document;
    }

    private void requireChanged(int count) {
        if (count != 1) throw missing();
    }

    private UUID identifier(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException error) {
            throw missing();
        }
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "대상을 찾을 수 없습니다.", null);
    }
}
