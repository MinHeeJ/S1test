package com.resumecraft.resumes;

import com.resumecraft.common.ApiResponse;
import com.resumecraft.common.DomainException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** HTTP contract for authenticated resume snapshots and owner-only commands. */
@RestController
@RequestMapping("/api/resumes")
public class ResumeController {
    private final ResumeService service;

    public ResumeController(ResumeService service) {
        this.service = service;
    }

    /** Pagination candidates are explicitly rejected until a bounded policy is approved. */
    @GetMapping
    public ApiResponse<List<Resume>> listResumes(
            Authentication actor,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size
    ) {
        if (page != null || size != null) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "400", "페이지 조건은 지원하지 않습니다.",
                    page != null ? "page" : "size");
        }
        return ApiResponse.ok(service.list(actor));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CreatedResume>> createResume(
            Authentication actor, @RequestBody CreateResumeRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.create(actor, request)));
    }

    @GetMapping("/{id}")
    public ApiResponse<Resume> getResume(Authentication actor, @PathVariable String id) {
        return ApiResponse.ok(service.get(actor, id));
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveResume(Authentication actor, @PathVariable String id, @RequestBody ResumeWrite request) {
        service.save(actor, id, request);
    }

    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void renameResume(Authentication actor, @PathVariable String id, @RequestBody RenameResumeRequest request) {
        service.rename(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(Authentication actor, @PathVariable String id) {
        service.delete(actor, id);
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<CreatedResume>> duplicateResume(Authentication actor, @PathVariable String id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.duplicate(actor, id)));
    }
}
