package com.example.resumes;

import com.example.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Owns atomic resume mutations and applies identical owner/active boundaries to every operation. */
@Service
public class ResumeService {
    private final ResumeMapper mapper;
    private final ObjectMapper json;
    private final ResumeStructureValidator validator;

    public ResumeService(ResumeMapper mapper, ObjectMapper json, ResumeStructureValidator validator) {
        this.mapper = mapper;
        this.json = json;
        this.validator = validator;
    }

    public UUID owner(String identity) {
        UUID owner = mapper.userId(identity);
        if (owner == null) throw new ApiException(401, "401", "로그인이 필요합니다.", null);
        return owner;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResumeListResponse list(String identity, int page, int size, String filter) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(400, "400", "페이지 범위를 확인해 주세요.", null);
        }
        UUID owner = owner(identity);
        String pattern = filter == null || filter.strip().isEmpty() ? null
            : "%" + filter.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return new ResumeListResponse(mapper.list(owner, pattern, size, (long) page * size),
            page, size, mapper.count(owner, pattern));
    }

    @Transactional(readOnly = true)
    public Resume get(String identity, UUID id) {
        return found(mapper.find(id, owner(identity)));
    }

    /** Uses the INSERT generated key, not a joined readback, to identify a newly created resume. */
    @Transactional
    public UUID create(String identity, JsonNode input) {
        validator.rejectManaged(input);
        String title = validator.title(input);
        String template = validator.template(input);
        UUID owner = owner(identity);
        Resume resume = new Resume();
        resume.setUserId(owner);
        resume.setTitle(title);
        resume.setTemplate(template);
        var style = json.createObjectNode();
        style.put("color", "#1F3A5F").put("font", "pretendard").put("size", "medium");
        resume.setStyle(style);
        var content = json.createArrayNode();
        var basics = content.addObject();
        basics.put("type", "basics").put("hidden", false);
        var data = basics.putObject("data");
        data.put("name", "").put("jobTitle", "").put("email", mapper.email(owner)).put("phone", "");
        data.putArray("links");
        data.putNull("photoId");
        var summary = content.addObject();
        summary.put("type", "summary").put("hidden", false);
        summary.putObject("data").put("headline", "").put("body", "");
        for (String type : new String[]{"experience", "education"}) {
            var section = content.addObject();
            section.put("type", type).put("hidden", false);
            section.putArray("items");
        }
        var skills = content.addObject();
        skills.put("type", "skills").put("hidden", false);
        skills.putObject("data").putArray("tags");
        resume.setContent(content);
        mapper.insert(resume);
        return resume.getId();
    }

    /** Measures the actual UTF-8 request bytes before parsing; a refused request performs no writes. */
    @Transactional
    public void update(String identity, UUID id, byte[] payload) {
        Resume resume = found(mapper.lock(id, owner(identity)));
        if (payload.length > 200_000) {
            throw new ApiException(413, "CONTENT_TOO_LARGE", "이력서는 200KB 이하만 저장할 수 있습니다.", null);
        }
        JsonNode input;
        try {
            input = json.readTree(payload);
        } catch (IOException exception) {
            throw new ApiException(400, "400", "잘못된 요청입니다.", null);
        }
        validator.validate(input);
        if (input.has("title")) resume.setTitle(validator.title(input));
        JsonNode photo = input.path("content").get(0).path("data").path("photoId");
        if (!photo.isMissingNode() && !photo.isNull()
            && mapper.photoExists(UUID.fromString(photo.textValue()), resume.getUserId()) == 0) {
            throw new ApiException(404, "404", "요청한 자료를 찾을 수 없습니다.", null);
        }
        resume.setTemplate(input.path("template").asText());
        resume.setStyle(input.get("style"));
        resume.setContent(input.get("content"));
        resume.setUpdatedAt(OffsetDateTime.now());
        changed(mapper.update(resume));
    }

    @Transactional
    public void rename(String identity, UUID id, JsonNode input) {
        Resume resume = found(mapper.lock(id, owner(identity)));
        validator.rejectManaged(input);
        resume.setTitle(validator.title(input));
        resume.setUpdatedAt(OffsetDateTime.now());
        changed(mapper.rename(resume));
    }

    /** Logical deletion intentionally does not delete shared or unreferenced photo bytes. */
    @Transactional
    public void delete(String identity, UUID id) {
        Resume resume = found(mapper.lock(id, owner(identity)));
        resume.setUpdatedAt(OffsetDateTime.now());
        changed(mapper.delete(resume));
    }

    /** One locked source snapshot is copied exactly, including item IDs and photo references. */
    @Transactional
    public UUID duplicate(String identity, UUID id) {
        Resume source = found(mapper.lock(id, owner(identity)));
        Resume copy = new Resume();
        copy.setUserId(source.getUserId());
        copy.setTitle(source.getTitle() + " (사본)");
        copy.setTemplate(source.getTemplate());
        copy.setStyle(source.getStyle().deepCopy());
        copy.setContent(source.getContent().deepCopy());
        mapper.insert(copy);
        return copy.getId();
    }

    private Resume found(Resume resume) {
        if (resume == null) throw new ApiException(404, "404", "요청한 자료를 찾을 수 없습니다.", null);
        return resume;
    }

    private void changed(int rows) {
        if (rows != 1) found(null);
    }
}
