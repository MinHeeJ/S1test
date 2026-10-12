package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.resumecraft.common.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Commands own complete transactions; all reads and writes share the same owner/deleted boundary. */
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

    public UUID owner(String identity) {
        UUID owner = mapper.owner(identity);
        if (owner == null) throw new ApiException(HttpStatus.UNAUTHORIZED,
            "UNAUTHENTICATED", "로그인이 필요합니다.", null);
        return owner;
    }

    @Transactional(readOnly = true)
    public List<Resume> list(UUID owner) {
        return mapper.list(owner);
    }

    @Transactional(readOnly = true)
    public Resume get(UUID id, UUID owner) {
        Resume resume = mapper.find(id, owner);
        if (resume == null) throw missing();
        return resume;
    }

    /** Creates the specified empty editing structure, using the account email from persistence. */
    @Transactional
    public UUID create(UUID owner, String title, String template) {
        String actualTitle = title == null ? "새 이력서" : title;
        validator.title(actualTitle);
        validator.template(template);
        ArrayNode content = json.createArrayNode();
        var basics = content.addObject().put("type", "basics").put("hidden", false).putObject("data");
        basics.put("name", "").put("jobTitle", "").put("email", mapper.email(owner)).put("phone", "");
        basics.putArray("links");
        basics.putNull("photoId");
        content.addObject().put("type", "summary").put("hidden", false)
            .putObject("data").put("headline", "").put("body", "");
        for (String type : List.of("experience", "education")) {
            content.addObject().put("type", type).put("hidden", false).putArray("items");
        }
        content.addObject().put("type", "skills").put("hidden", false).putObject("data").putArray("tags");
        var style = json.createObjectNode().put("color", "#1F3A5F").put("font", "pretendard").put("size", "medium");
        UUID id = UUID.randomUUID();
        mapper.insert(id, owner, new ResumeWrite(actualTitle, template, style, content));
        return id;
    }

    /** Full replacement preserves user strings; photo references must exist and belong to the caller. */
    @Transactional
    public void save(UUID id, UUID owner, ResumeWrite write) {
        get(id, owner);
        validator.validate(write);
        var photo = write.content().get(0).path("data").get("photoId");
        if (!photo.isNull()) {
            UUID photoId;
            try {
                photoId = UUID.fromString(photo.asText());
            } catch (IllegalArgumentException error) {
                ResumeStructureValidator.invalid("content[0].data.photoId");
                return;
            }
            if (!mapper.photoOwned(photoId, owner)) ResumeStructureValidator.invalid("content[0].data.photoId");
        }
        if (mapper.save(id, owner, write) != 1) throw missing();
    }

    @Transactional
    public void rename(UUID id, UUID owner, String title) {
        get(id, owner);
        validator.title(title);
        if (mapper.rename(id, owner, title) != 1) throw missing();
    }

    /** Leaves the physical row and photos intact; all later operations treat the row as absent. */
    @Transactional
    public void delete(UUID id, UUID owner) {
        if (mapper.delete(id, owner) != 1) throw missing();
    }

    /** A whole-resume copy retains content and its same-owner photo reference exactly. */
    @Transactional
    public UUID duplicate(UUID id, UUID owner) {
        Resume original = get(id, owner);
        UUID copy = UUID.randomUUID();
        mapper.insert(copy, owner, new ResumeWrite(original.title() + " (사본)", original.template(),
            original.style(), original.content()));
        return copy;
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "이력서를 찾을 수 없습니다.", null);
    }
}
