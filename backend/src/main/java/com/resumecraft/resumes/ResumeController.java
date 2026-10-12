package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.CurrentUserId;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** Session-authenticated resume transport; ownership comes exclusively from the security principal. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    /** Returns all live owned resumes, without activating unapproved pagination. */
    @GetMapping
    public ApiResponse<List<ResumeRecord>> listResumes() {
        return ApiResponse.of(service.list(CurrentUserId.require()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CreatedResume> createResume(@RequestBody JsonNode request) {
        return ApiResponse.of(new CreatedResume(service.create(CurrentUserId.require(), request)));
    }

    @GetMapping("/{id}")
    public ApiResponse<ResumeRecord> getResume(@PathVariable UUID id) {
        return ApiResponse.of(service.get(CurrentUserId.require(), id));
    }

    /** Successful writes deliberately have no response body. */
    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveResume(@PathVariable UUID id, @RequestBody JsonNode request) {
        service.save(CurrentUserId.require(), id, request);
    }

    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void renameResume(@PathVariable UUID id, @RequestBody JsonNode request) {
        service.rename(CurrentUserId.require(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(@PathVariable UUID id) {
        service.delete(CurrentUserId.require(), id);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CreatedResume> duplicateResume(@PathVariable UUID id) {
        return ApiResponse.of(new CreatedResume(service.duplicate(CurrentUserId.require(), id)));
    }

    /** Identifier response used by both create and duplicate. */
    public record CreatedResume(UUID id) {
    }
}
