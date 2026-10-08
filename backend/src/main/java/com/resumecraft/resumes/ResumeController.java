package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionAuthentication;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** 세션 사용자와 path id만 서비스로 전달하는 이력서 HTTP 경계. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<ResumeService.Resume>> listResumes(
            Authentication actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String filter) {
        return service.list(SessionAuthentication.userId(actor), page, size, filter);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> createResume(Authentication actor, @RequestBody JsonNode input) {
        return ApiResponse.ok(Map.of("id", service.create(SessionAuthentication.userId(actor), input)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ResumeService.Resume> getResume(Authentication actor, @PathVariable UUID id) {
        return ApiResponse.ok(service.get(id, SessionAuthentication.userId(actor)));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> updateResume(Authentication actor, @PathVariable UUID id, @RequestBody JsonNode input) {
        service.update(id, SessionAuthentication.userId(actor), input);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse<Void> renameResume(Authentication actor, @PathVariable UUID id, @RequestBody JsonNode input) {
        service.rename(id, SessionAuthentication.userId(actor), input);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteResume(Authentication actor, @PathVariable UUID id) {
        service.delete(id, SessionAuthentication.userId(actor));
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> duplicateResume(Authentication actor, @PathVariable UUID id) {
        return ApiResponse.ok(Map.of("id", service.duplicate(id, SessionAuthentication.userId(actor))));
    }
}
