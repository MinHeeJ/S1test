package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Validates only storage structure, never completeness, email validity or dates in unfinished drafts. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, String> FIELDS = Map.of(
            "basics", "name jobTitle email phone",
            "summary", "headline body",
            "skills", "",
            "experience", "id company position start end description",
            "education", "id school major degree start end",
            "projects", "id name role start end description url",
            "certificates", "id name issuer date",
            "languages", "id language test score");

    /** Measures the complete UTF-8 JSON payload and keeps unknown JSON properties losslessly. */
    public void validate(JsonNode input) {
        if (input.toString().getBytes(StandardCharsets.UTF_8).length > 200000) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE",
                    "本文は200KB以内にしてください。", null);
        }
        check(input.isObject(), null);
        template(input.get("template"));
        JsonNode style = input.path("style");
        check(style.isObject(), "style");
        check(style.path("color").isTextual() && style.path("color").asText().matches("#[0-9a-fA-F]{6}"),
                "style.color");
        check(Set.of("pretendard", "noto-serif-kr").contains(style.path("font").asText()), "style.font");
        check(Set.of("small", "medium", "large").contains(style.path("size").asText()), "style.size");
        JsonNode content = input.path("content");
        check(content.isArray() && content.size() >= 1 && content.size() <= 8, "content");
        check(content.get(0).path("type").asText().equals("basics")
                && content.get(0).path("hidden").isBoolean()
                && !content.get(0).path("hidden").asBoolean(), "content[0]");
        Set<String> seen = new HashSet<>();
        for (JsonNode section : content) {
            String type = section.path("type").asText();
            check(section.isObject() && FIELDS.containsKey(type) && seen.add(type), "content.type");
            check(section.path("hidden").isBoolean(), "content.hidden");
            if (Set.of("basics", "summary", "skills").contains(type)) {
                JsonNode data = section.path("data");
                check(data.isObject(), "content.data");
                strings(data, FIELDS.get(type));
                if (type.equals("basics")) {
                    if (data.has("links")) {
                        array(data.get("links"), 3);
                        for (JsonNode link : data.get("links")) {
                            check(link.isObject(), "content.data.links");
                            strings(link, "label url");
                        }
                    }
                    if (data.has("photoId")) {
                        check(data.get("photoId").isNull() || data.get("photoId").isTextual(), "content.data.photoId");
                    }
                } else if (type.equals("skills") && data.has("tags")) {
                    array(data.get("tags"), 30);
                    for (JsonNode tag : data.get("tags")) check(tag.isTextual(), "content.data.tags");
                }
            } else {
                array(section.path("items"), 20);
                for (JsonNode item : section.get("items")) {
                    check(item.isObject(), "content.items");
                    strings(item, FIELDS.get(type));
                    if (Set.of("experience", "education").contains(type) && item.has("current")) {
                        check(item.get("current").isBoolean(), "content.items.current");
                    }
                    if (type.equals("education") && item.has("degree")) {
                        check(Set.of("", "고졸", "학사", "석사", "박사").contains(item.get("degree").asText()),
                                "content.items.degree");
                    }
                }
            }
        }
    }

    public void template(JsonNode value) {
        check(value != null && value.isTextual() && Set.of("classic", "modern").contains(value.asText()),
                "template");
    }

    public String title(JsonNode value) {
        if (value == null || !value.isTextual() || value.asText().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "제목을 입력해 주세요.", "title");
        }
        return value.asText().trim();
    }

    private void array(JsonNode value, int maximum) {
        check(value.isArray() && value.size() <= maximum, "content");
    }

    private void strings(JsonNode object, String fields) {
        for (String field : fields.split(" ")) {
            if (!field.isEmpty() && object.has(field)) check(object.get(field).isTextual(), "content." + field);
        }
    }

    private void check(boolean valid, String field) {
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "본문 구조를 확인해 주세요.", field);
    }
}
