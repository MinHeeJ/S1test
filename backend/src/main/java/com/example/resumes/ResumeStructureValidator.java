package com.example.resumes;

import com.example.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Checks storage structure only; incomplete names, email and dates deliberately remain saveable. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, Set<String>> STRINGS = Map.of(
        "basics", Set.of("name", "jobTitle", "email", "phone"),
        "summary", Set.of("headline", "body"),
        "experience", Set.of("id", "company", "position", "start", "end", "description"),
        "education", Set.of("id", "school", "major", "degree", "start", "end"),
        "projects", Set.of("id", "name", "role", "start", "end", "description", "url"),
        "certificates", Set.of("id", "name", "issuer", "date"),
        "languages", Set.of("id", "language", "test", "score"),
        "skills", Set.of()
    );

    public String title(JsonNode input) {
        JsonNode title = input == null ? null : input.get("title");
        if (title == null || !title.isTextual() || title.textValue().strip().isEmpty()) {
            throw new ApiException(400, "400", "제목을 입력해 주세요.", "title");
        }
        return title.textValue().strip();
    }

    public String template(JsonNode input) {
        JsonNode value = input == null ? null : input.get("template");
        require(value != null && value.isTextual()
            && Set.of("classic", "modern").contains(value.textValue()), "template");
        return value.textValue();
    }

    /** Optional properties are checked when present, never filled with fabricated values. */
    public void validate(JsonNode input) {
        require(input != null && input.isObject(), null);
        rejectManaged(input);
        template(input);
        JsonNode style = input.path("style");
        require(style.isObject(), "style");
        require(style.path("color").isTextual()
            && style.path("color").textValue().matches("#[0-9a-fA-F]{6}"), "style.color");
        require(style.path("font").isTextual()
            && Set.of("pretendard", "noto-serif-kr").contains(style.path("font").asText()), "style.font");
        require(style.path("size").isTextual()
            && Set.of("small", "medium", "large").contains(style.path("size").asText()), "style.size");
        JsonNode content = input.path("content");
        require(content.isArray() && !content.isEmpty() && content.size() <= 8, "content");
        require("basics".equals(content.get(0).path("type").asText()), "content");
        Set<String> seen = new HashSet<>();
        for (JsonNode section : content) {
            require(section.isObject() && section.path("type").isTextual(), "content");
            String type = section.path("type").asText();
            require(STRINGS.containsKey(type) && seen.add(type), "content");
            require(section.path("hidden").isBoolean(), "content.hidden");
            if (type.equals("basics")) require(!section.path("hidden").asBoolean(), "content.hidden");
            if (Set.of("basics", "summary", "skills").contains(type)) {
                require(section.path("data").isObject() && !section.has("items"), "content.data");
                fields(type, section.path("data"));
            } else {
                JsonNode items = section.path("items");
                require(items.isArray() && items.size() <= 20 && !section.has("data"), "content.items");
                for (JsonNode item : items) fields(type, item);
            }
        }
    }

    public void rejectManaged(JsonNode input) {
        require(input != null && input.isObject(), null);
        for (String field : Set.of("id", "user_id", "userId", "deleted", "created_at", "updated_at", "completeness")) {
            require(!input.has(field), field);
        }
    }

    private void fields(String type, JsonNode value) {
        require(value.isObject(), "content");
        for (String field : STRINGS.get(type)) {
            if (value.has(field)) require(value.get(field).isTextual(), "content." + field);
        }
        if (value.has("current")) require(value.get("current").isBoolean(), "content.current");
        if (type.equals("education") && value.has("degree")) {
            require(Set.of("", "고졸", "학사", "석사", "박사").contains(value.path("degree").asText()), "content.degree");
        }
        if (type.equals("skills") && value.has("tags")) {
            JsonNode tags = value.get("tags");
            require(tags.isArray() && tags.size() <= 30, "content.tags");
            for (JsonNode tag : tags) require(tag.isTextual(), "content.tags");
        }
        if (type.equals("basics")) {
            if (value.has("links")) {
                JsonNode links = value.get("links");
                require(links.isArray() && links.size() <= 3, "content.links");
                for (JsonNode link : links) {
                    require(link.isObject(), "content.links");
                    for (String key : Set.of("label", "url")) {
                        if (link.has(key)) require(link.get(key).isTextual(), "content.links." + key);
                    }
                }
            }
            if (value.has("photoId") && !value.get("photoId").isNull()) {
                require(value.get("photoId").isTextual(), "content.photoId");
                try {
                    UUID.fromString(value.get("photoId").textValue());
                } catch (IllegalArgumentException exception) {
                    require(false, "content.photoId");
                }
            }
        }
    }

    private void require(boolean condition, String field) {
        if (!condition) throw new ApiException(400, "INVALID_STRUCTURE", "이력서 구조를 확인해 주세요.", field);
    }
}
