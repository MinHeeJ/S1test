package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.resumecraft.common.DomainException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owns resume commands and their transaction boundaries; other users and deleted rows stay indistinguishable. */
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

    public List<ResumeRecord> list(UUID owner) {
        return mapper.list(owner);
    }

    public ResumeRecord get(UUID owner, UUID id) {
        ResumeRecord result = mapper.find(id, owner);
        if (result == null) {
            throw DomainException.notFound();
        }
        return result;
    }

    /** Creates only documented empty defaults, with the authenticated account's persisted email. */
    @Transactional
    public UUID create(UUID owner, JsonNode request) {
        String template = validator.template(request.get("template"));
        String title = request.has("title") ? validator.title(request.get("title")) : "새 이력서";
        String email = mapper.email(owner);
        if (email == null) {
            throw DomainException.notFound();
        }
        ArrayNode content = json.createArrayNode();
        var basics = content.addObject();
        basics.put("type", "basics").put("hidden", false);
        var data = basics.putObject("data");
        data.put("name", "").put("jobTitle", "").put("email", email).put("phone", "").putNull("photoId");
        data.putArray("links");
        var summary = content.addObject();
        summary.put("type", "summary").put("hidden", false);
        summary.putObject("data").put("headline", "").put("body", "");
        for (String type : List.of("experience", "education")) {
            var section = content.addObject();
            section.put("type", type).put("hidden", false);
            section.putArray("items");
        }
        var skills = content.addObject();
        skills.put("type", "skills").put("hidden", false);
        skills.putObject("data").putArray("tags");
        var style = json.createObjectNode().put("color", "#1F3A5F")
            .put("font", "pretendard").put("size", "medium");
        UUID id = UUID.randomUUID();
        requireOne(mapper.insert(id, owner, new ResumeWrite(title, template, style, content)));
        return id;
    }

    /** Photo ownership is verified before any write; linking does not mutate or purge the photo. */
    @Transactional
    public void save(UUID owner, UUID id, JsonNode request) {
        get(owner, id);
        ResumeWrite write = validator.validate(request);
        JsonNode photo = write.content().get(0).path("data").get("photoId");
        if (!photo.isNull() && !mapper.ownsPhoto(UUID.fromString(photo.textValue()), owner)) {
            throw DomainException.notFound();
        }
        requireOne(mapper.save(id, owner, write));
    }

    /** Title-only command cannot modify any body, style, identity or deletion fields. */
    @Transactional
    public void rename(UUID owner, UUID id, JsonNode request) {
        get(owner, id);
        requireOne(mapper.rename(id, owner, validator.title(request.get("title"))));
    }

    @Transactional
    public void delete(UUID owner, UUID id) {
        requireOne(mapper.delete(id, owner));
    }

    /** Atomic source-scoped duplication preserves item IDs and same-owner photoId verbatim. */
    @Transactional
    public UUID duplicate(UUID owner, UUID id) {
        UUID created = mapper.duplicate(id, owner);
        if (created == null) {
            throw DomainException.notFound();
        }
        return created;
    }

    private void requireOne(int affected) {
        if (affected != 1) {
            throw DomainException.notFound();
        }
    }
}
