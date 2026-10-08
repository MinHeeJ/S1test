package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiException;
import com.resumecraft.common.SessionUser;
import com.resumecraft.common.persistence.PhotoMapper;
import com.resumecraft.common.persistence.ResumeMapper;
import com.resumecraft.common.persistence.ResumeRow;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Orchestrates owner-scoped resume persistence; each mutation has one transaction and no photo deletion. */
@Service
public class ResumeService {
    private final ResumeMapper resumes;
    private final PhotoMapper photos;
    private final ObjectMapper json;
    private final ResumeStructureValidator validator;

    public ResumeService(ResumeMapper resumes, PhotoMapper photos, ObjectMapper json,
            ResumeStructureValidator validator) {
        this.resumes = resumes;
        this.photos = photos;
        this.json = json;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public List<ResumeView> list(SessionUser user, int page, int size, String filter) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw standard(HttpStatus.BAD_REQUEST, null);
        }
        return resumes.listFilteredOwned(user.id(), page * size, size, filter).stream()
            .map(ResumeView::from).toList();
    }

    @Transactional(readOnly = true)
    public ResumeView get(SessionUser user, UUID id) {
        return ResumeView.from(owned(user, id));
    }

    @Transactional
    public UUID create(SessionUser user, JsonNode input) {
        String title = title(input.get("title"));
        String template = validator.template(input.get("template"));
        ArrayNode content = json.createArrayNode();
        ObjectNode basics = section(content, "basics").putObject("data");
        for (String field : List.of("name", "jobTitle", "email", "phone")) basics.put(field, "");
        basics.put("email", user.email());
        basics.putArray("links");
        basics.putNull("photoId");
        section(content, "summary").putObject("data").put("headline", "").put("body", "");
        section(content, "experience").putArray("items");
        section(content, "education").putArray("items");
        section(content, "skills").putObject("data").putArray("tags");
        ObjectNode style = json.createObjectNode().put("color", "#1F3A5F")
            .put("font", "pretendard").put("size", "medium");
        return insert(user, title, template, style, content);
    }

    private ObjectNode section(ArrayNode content, String type) {
        return content.addObject().put("type", type).put("hidden", false);
    }

    @Transactional
    public UUID duplicate(SessionUser user, UUID id) {
        ResumeRow source = owned(user, id);
        return insert(user, source.title() + " (사본)", source.template(),
            source.style().deepCopy(), source.content().deepCopy());
    }

    private UUID insert(SessionUser user, String title, String template, JsonNode style, JsonNode content) {
        UUID id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        resumes.insert(new ResumeRow(id, user.id(), title, template, style, content, false, now, now));
        return id;
    }

    /** Byte count includes the original whole UTF-8 request, before parsing or discarding unknown fields. */
    @Transactional
    public void update(SessionUser user, UUID id, byte[] bytes) {
        owned(user, id);
        if (bytes.length > 200000) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE", "이력서 크기가 200KB를 초과합니다.", null);
        }
        JsonNode input;
        try {
            input = json.readTree(bytes);
        } catch (IOException exception) {
            throw standard(HttpStatus.BAD_REQUEST, null);
        }
        if (input == null || !input.isObject()) throw standard(HttpStatus.BAD_REQUEST, null);
        String title = input.has("title") ? title(input.get("title")) : null;
        String template = validator.template(input.get("template"));
        JsonNode style = validator.style(input.get("style"));
        JsonNode content = validator.content(input.get("content"));
        JsonNode photo = content.get(0).path("data").get("photoId");
        if (photo != null && !photo.isNull()
                && photos.findOwned(UUID.fromString(photo.textValue()), user.id()) == null) {
            throw standard(HttpStatus.NOT_FOUND, null);
        }
        changed(resumes.updateOwned(id, user.id(), title, template, style, content, OffsetDateTime.now()));
    }

    @Transactional
    public void rename(SessionUser user, UUID id, JsonNode input) {
        owned(user, id);
        changed(resumes.renameOwned(id, user.id(), title(input.get("title")), OffsetDateTime.now()));
    }

    @Transactional
    public void delete(SessionUser user, UUID id) {
        changed(resumes.deleteOwned(id, user.id(), OffsetDateTime.now()));
    }

    private ResumeRow owned(SessionUser user, UUID id) {
        ResumeRow row = resumes.findOwned(id, user.id());
        if (row == null) throw standard(HttpStatus.NOT_FOUND, null);
        return row;
    }

    private void changed(int count) {
        if (count != 1) throw standard(HttpStatus.NOT_FOUND, null);
    }

    private String title(JsonNode node) {
        if (node == null || !node.isTextual() || node.textValue().strip().isEmpty()) {
            throw standard(HttpStatus.BAD_REQUEST, "title");
        }
        return node.textValue().strip();
    }

    private ApiException standard(HttpStatus status, String field) {
        return new ApiException(status, status.getReasonPhrase(), status.getReasonPhrase(), field);
    }
}
