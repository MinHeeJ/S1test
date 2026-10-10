package com.example.resumes;

import com.example.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import java.security.Principal;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/** Thin HTTP projection of owner-scoped resume operations; session and CSRF admission remain shared. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    public ResumeListResponse listResumes(Principal principal,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String filter) {
        return service.list(principal.getName(), page, size, filter);
    }

    @PostMapping
    public ApiResponse<Map<String, UUID>> createResume(Principal principal, @RequestBody JsonNode input) {
        return ApiResponse.ok(Map.of("id", service.create(principal.getName(), input)));
    }

    @GetMapping("/{id}")
    public ApiResponse<Resume> getResume(Principal principal, @PathVariable UUID id) {
        return ApiResponse.ok(service.get(principal.getName(), id));
    }

    @PutMapping(value = "/{id}", consumes = "application/json")
    public ApiResponse<Void> updateResume(Principal principal, @PathVariable UUID id, @RequestBody byte[] payload) {
        service.update(principal.getName(), id, payload);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse<Void> renameResume(Principal principal, @PathVariable UUID id, @RequestBody JsonNode input) {
        service.rename(principal.getName(), id, input);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteResume(Principal principal, @PathVariable UUID id) {
        service.delete(principal.getName(), id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/duplicate")
    public ApiResponse<Map<String, UUID>> duplicateResume(Principal principal, @PathVariable UUID id) {
        return ApiResponse.ok(Map.of("id", service.duplicate(principal.getName(), id)));
    }
}
