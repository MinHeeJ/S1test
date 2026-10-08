package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionUser;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** HTTP resume operations delegate all data-scope and transactional rules to ResumeService. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    public Object listResumes(@AuthenticationPrincipal SessionUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String filter) {
        return ApiResponse.data(service.list(user, page, size, filter));
    }

    @PostMapping
    public ResponseEntity<?> createResume(@AuthenticationPrincipal SessionUser user, @RequestBody JsonNode input) {
        return ResponseEntity.status(201).body(ApiResponse.data(Map.of("id", service.create(user, input))));
    }

    @GetMapping("/{id}")
    public Object getResume(@AuthenticationPrincipal SessionUser user, @PathVariable UUID id) {
        return ApiResponse.data(service.get(user, id));
    }

    @PutMapping("/{id}")
    public ApiResponse updateResume(@AuthenticationPrincipal SessionUser user, @PathVariable UUID id,
            @RequestBody byte[] bytes) {
        service.update(user, id, bytes);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse renameResume(@AuthenticationPrincipal SessionUser user, @PathVariable UUID id,
            @RequestBody JsonNode input) {
        service.rename(user, id, input);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse deleteResume(@AuthenticationPrincipal SessionUser user, @PathVariable UUID id) {
        service.delete(user, id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<?> duplicateResume(@AuthenticationPrincipal SessionUser user, @PathVariable UUID id) {
        return ResponseEntity.status(201).body(ApiResponse.data(Map.of("id", service.duplicate(user, id))));
    }
}
