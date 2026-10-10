package com.example.resumes;

import com.example.common.ApiResponse;
import java.util.List;
import java.util.Map;

/** Pagination metadata belongs only to the collection response, not command envelopes. */
public class ResumeListResponse extends ApiResponse<List<Resume>> {
    private final Map<String, Object> meta;

    public ResumeListResponse(List<Resume> data, int page, int size, long total) {
        super(data);
        meta = Map.of("page", page, "size", size, "totalElements", total,
            "totalPages", total / size + (total % size == 0 ? 0 : 1));
    }

    @Override
    public Map<String, Object> getMeta() {
        return meta;
    }
}
