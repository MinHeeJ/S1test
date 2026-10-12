package com.resumecraft.resumes;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.ApiException;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Session-authenticated resume HTTP contract; service resolves owner identity, never request user_id. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    public record CreateResumeRequest(String title, String template) { }
    public record RenameResumeRequest(String title) { }

    @GetMapping
    public ApiResponse<List<Resume>> listResumes(Principal principal) {
        return ApiResponse.of(service.list(owner(principal)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> createResume(Principal principal, @RequestBody CreateResumeRequest request) {
        return ApiResponse.of(Map.of("id", service.create(owner(principal), request.title(), request.template())));
    }

    @GetMapping("/{id}")
    public ApiResponse<Resume> getResume(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.get(id(id), owner(principal)));
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveResume(Principal principal, @PathVariable String id, @RequestBody ResumeWrite request) {
        service.save(id(id), owner(principal), request);
    }

    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void renameResume(Principal principal, @PathVariable String id, @RequestBody RenameResumeRequest request) {
        service.rename(id(id), owner(principal), request.title());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(Principal principal, @PathVariable String id) {
        service.delete(id(id), owner(principal));
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> duplicateResume(Principal principal, @PathVariable String id) {
        return ApiResponse.of(Map.of("id", service.duplicate(id(id), owner(principal))));
    }

    private UUID owner(Principal principal) {
        if (principal == null) throw new ApiException(HttpStatus.UNAUTHORIZED,
            "UNAUTHENTICATED", "로그인이 필요합니다.", null);
        return service.owner(principal.getName());
    }

    private UUID id(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException error) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "이력서를 찾을 수 없습니다.", null);
        }
    }
}
