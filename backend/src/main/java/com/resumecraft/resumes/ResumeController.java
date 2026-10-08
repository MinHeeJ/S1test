package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.SessionUser;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** HTTP draft API: every operation delegates using the authenticated identity, never a client-supplied owner. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<ResumeDocument>> list(@AuthenticationPrincipal SessionUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String filter) {
        return ApiResponse.of(service.list(user, page, size, filter));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> create(@AuthenticationPrincipal SessionUser user,
            @RequestBody JsonNode input) {
        return ApiResponse.of(Map.of("id", service.create(user, input)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ResumeDocument> get(@AuthenticationPrincipal SessionUser user, @PathVariable String id) {
        return ApiResponse.of(service.get(user, id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@AuthenticationPrincipal SessionUser user, @PathVariable String id,
            @RequestBody JsonNode input) {
        service.update(user, id, input);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}")
    public ApiResponse<Void> rename(@AuthenticationPrincipal SessionUser user, @PathVariable String id,
            @RequestBody JsonNode input) {
        service.rename(user, id, input);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal SessionUser user, @PathVariable String id) {
        service.delete(user, id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> duplicate(@AuthenticationPrincipal SessionUser user,
            @PathVariable String id) {
        return ApiResponse.of(Map.of("id", service.duplicate(user, id)));
    }
}
