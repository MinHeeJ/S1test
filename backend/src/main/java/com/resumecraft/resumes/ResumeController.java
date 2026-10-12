package com.resumecraft.resumes;

import com.resumecraft.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP contract for authenticated resume CRUD; services and SQL enforce ownership. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<Resume>> listResumes(Authentication actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String filter) {
        return service.list(service.actor(actor).id(), page, size, filter);
    }

    @PostMapping
    public ApiResponse<Map<String, String>> createResume(Authentication actor, @RequestBody CreateResumeInput input) {
        return ApiResponse.ok(Map.of("id", service.create(service.actor(actor), input)));
    }

    @GetMapping("/{id}")
    public ApiResponse<Resume> getResume(Authentication actor, @PathVariable Long id) {
        return ApiResponse.ok(service.get(id, service.actor(actor).id()));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> updateResume(Authentication actor, @PathVariable Long id,
            @RequestBody UpdateResumeInput input) {
        service.update(id, service.actor(actor).id(), input);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse<Void> renameResume(Authentication actor, @PathVariable Long id,
            @RequestBody RenameResumeInput input) {
        service.rename(id, service.actor(actor).id(), input);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteResume(Authentication actor, @PathVariable Long id) {
        service.delete(id, service.actor(actor).id());
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/duplicate")
    public ApiResponse<Map<String, String>> duplicateResume(Authentication actor, @PathVariable Long id) {
        return ApiResponse.ok(Map.of("id", service.duplicate(id, service.actor(actor).id())));
    }
}
