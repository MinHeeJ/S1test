package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiException;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.persistence.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates owner-scoped document operations through the foundation's blocking XML adapters. */
@Service
public class ResumeService {
    private final ResumeMapper resumes;
    private final UserMapper users;
    private final PhotoMapper photos;
    private final ResumeStructureValidator validator;
    private final ObjectMapper json;

    public ResumeService(ResumeMapper resumes, UserMapper users, PhotoMapper photos,
            ResumeStructureValidator validator, ObjectMapper json) {
        this.resumes = resumes;
        this.users = users;
        this.photos = photos;
        this.validator = validator;
        this.json = json;
    }

    /** Resolves only a server-authenticated identity, never an owner from request JSON. */
    public UserRow actor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        String name = authentication.getName();
        UserRow user = users.findByEmail(name);
        if (user == null && name.matches("[0-9]+")) {
            try {
                user = users.findById(Long.valueOf(name));
            } catch (NumberFormatException ignored) {
                // An out-of-range principal is not a valid persisted account.
            }
        }
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        return user;
    }

    @Transactional(readOnly = true)
    public ApiResponse<List<Resume>> list(Long userId, int page, int size, String filter) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "400", "페이지 범위를 확인해 주세요.",
                    page < 0 ? "page" : "size");
        }
        long total = resumes.countOwned(userId, filter);
        var rows = resumes.listPage(userId, filter, size, (long) page * size);
        return new ApiResponse<>(true, Map.of("page", page, "size", size,
                "totalElements", total, "totalPages", (total + size - 1) / size),
                rows.stream().map(Resume::from).toList());
    }

    @Transactional(readOnly = true)
    public Resume get(Long id, Long userId) {
        return Resume.from(owned(id, userId));
    }

    /** Defaults are created server-side and derive the email from the persisted session account. */
    @Transactional
    public String create(UserRow user, CreateResumeInput input) {
        String title = validator.title(input.title());
        String template = validator.template(input.template(), "400");
        var content = json.createArrayNode();
        var basics = content.addObject().put("type", "basics").put("hidden", false).putObject("data");
        basics.put("name", "").put("jobTitle", "").put("email", user.email()).put("phone", "");
        basics.putArray("links");
        basics.putNull("photoId");
        content.addObject().put("type", "summary").put("hidden", false)
                .putObject("data").put("headline", "").put("body", "");
        content.addObject().put("type", "experience").put("hidden", false).putArray("items");
        content.addObject().put("type", "education").put("hidden", false).putArray("items");
        content.addObject().put("type", "skills").put("hidden", false).putObject("data").putArray("tags");
        var style = json.createObjectNode().put("color", "#1F3A5F").put("font", "pretendard").put("size", "medium");
        return resumes.insert(user.id(), title, template, style, content).toString();
    }

    /** Rejected structures and foreign photos perform no write; title is exclusively PATCH-owned. */
    @Transactional
    public void update(Long id, Long userId, UpdateResumeInput input) {
        owned(id, userId);
        validator.validate(input);
        var photo = input.content().get(0).path("data").path("photoId");
        if (!photo.isMissingNode() && !photo.isNull()
                && photos.findOwned(UUID.fromString(photo.asText()), userId) == null) {
            throw missing();
        }
        changed(resumes.updateOwned(id, userId, input.template().asText(), input.style(), input.content()));
    }

    @Transactional
    public void rename(Long id, Long userId, RenameResumeInput input) {
        owned(id, userId);
        changed(resumes.renameOwned(id, userId, validator.title(input.title())));
    }

    /** Soft deletion never removes the original row or referenced photo bytes. */
    @Transactional
    public void delete(Long id, Long userId) {
        changed(resumes.deleteOwned(id, userId));
    }

    /** Copies every JSON value including item IDs and photo references without touching the original. */
    @Transactional
    public String duplicate(Long id, Long userId) {
        ResumeRow original = owned(id, userId);
        return resumes.insert(userId, original.title() + " (사본)", original.template(),
                original.style().deepCopy(), original.content().deepCopy()).toString();
    }

    private ResumeRow owned(Long id, Long userId) {
        ResumeRow row = resumes.findOwned(id, userId);
        if (row == null) {
            throw missing();
        }
        return row;
    }

    private void changed(int rows) {
        if (rows != 1) {
            throw missing();
        }
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.NOT_FOUND, "404", "자료를 찾을 수 없습니다.", null);
    }
}
