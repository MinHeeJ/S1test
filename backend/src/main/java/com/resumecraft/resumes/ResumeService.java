package com.resumecraft.resumes;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.DomainException;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-scoped snapshot commands preserve drafts and never delete retained photo bytes. */
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

    /** Resolve the security principal against accounts, not against caller-supplied ownership fields. */
    private ResumeAccount actor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) unauthorized();
        ResumeAccount account = mapper.account(authentication.getName());
        if (account == null) unauthorized();
        return account;
    }

    public List<Resume> list(Authentication authentication) {
        return mapper.list(actor(authentication).id()).stream().map(this::publicResume).toList();
    }

    public Resume get(Authentication authentication, String id) {
        return publicResume(required(id, actor(authentication).id()));
    }

    @Transactional
    public CreatedResume create(Authentication authentication, CreateResumeRequest request) {
        ResumeAccount account = actor(authentication);
        String title = request.title() == null ? "새 이력서" : request.title();
        validator.title(title);
        validator.template(request.template());
        String style = json.createObjectNode().put("color", "#1F3A5F")
                .put("font", "pretendard").put("size", "medium").toString();
        Long id = mapper.insert(account.id(), title, request.template(), style,
                ResumeDefaults.content(json, account).toString());
        return new CreatedResume(id.toString());
    }

    /** Validate before mutation; upload and photo linkage intentionally remain separate transactions. */
    @Transactional
    public void save(Authentication authentication, String id, ResumeWrite write) {
        Long userId = actor(authentication).id();
        ResumeRow row = required(id, userId);
        validator.validate(write);
        var photo = write.content().get(0).get("data").get("photoId");
        if (!photo.isNull() && !mapper.ownsPhoto(photo.asText(), userId)) notFound();
        changed(mapper.save(row.id(), userId, write.title(), write.template(),
                write.style().toString(), write.content().toString()));
    }

    @Transactional
    public void rename(Authentication authentication, String id, RenameResumeRequest request) {
        Long userId = actor(authentication).id();
        ResumeRow row = required(id, userId);
        validator.title(request.title());
        changed(mapper.rename(row.id(), userId, request.title()));
    }

    /** Only the live owner's row becomes deleted; content, timestamps and photos are retained. */
    @Transactional
    public void delete(Authentication authentication, String id) {
        Long userId = actor(authentication).id();
        changed(mapper.delete(required(id, userId).id(), userId));
    }

    @Transactional
    public CreatedResume duplicate(Authentication authentication, String id) {
        Long userId = actor(authentication).id();
        ResumeRow row = required(id, userId);
        Long key = mapper.insert(userId, row.title() + " (사본)", row.template(), row.style(), row.content());
        return new CreatedResume(key.toString());
    }

    private ResumeRow required(String id, Long userId) {
        Long key;
        try {
            key = Long.valueOf(id);
        } catch (NumberFormatException error) {
            throw new DomainException(HttpStatus.NOT_FOUND, "404", "이력서를 찾을 수 없습니다.", null);
        }
        ResumeRow row = mapper.find(key, userId);
        if (row == null) notFound();
        return row;
    }

    private Resume publicResume(ResumeRow row) {
        try {
            return new Resume(row.id().toString(), row.title(), row.template(), json.readTree(row.style()),
                    json.readTree(row.content()), row.updatedAt().withOffsetSameInstant(ZoneOffset.UTC).toString());
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("저장 자료를 읽지 못했습니다.");
        }
    }

    private void changed(int count) {
        if (count != 1) notFound();
    }

    private void notFound() {
        throw new DomainException(HttpStatus.NOT_FOUND, "404", "이력서를 찾을 수 없습니다.", null);
    }

    private void unauthorized() {
        throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
    }
}
