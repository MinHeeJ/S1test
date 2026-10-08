package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.ApiException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Validates structure, not completeness; unfinished email and date strings remain saveable. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, Set<String>> STRINGS = Map.of(
        "basics", Set.of("name", "jobTitle", "email", "phone"),
        "summary", Set.of("headline", "body"),
        "skills", Set.of(),
        "experience", Set.of("id", "company", "position", "start", "end", "description"),
        "education", Set.of("id", "school", "major", "degree", "start", "end"),
        "projects", Set.of("id", "name", "role", "start", "end", "description", "url"),
        "certificates", Set.of("id", "name", "issuer", "date"),
        "languages", Set.of("id", "language", "test", "score")
    );

    /** Checks required containers and present optional fields, dropping non-contract payload keys. */
    public JsonNode content(JsonNode content) {
        require(content != null && content.isArray() && !content.isEmpty() && content.size() <= 8);
        JsonNode clean = content.deepCopy();
        Set<String> seen = new HashSet<>();
        int index = 0;
        for (JsonNode section : clean) {
            require(section.isObject() && section.path("type").isTextual()
                && section.path("hidden").isBoolean());
            String type = section.path("type").textValue();
            require(STRINGS.containsKey(type) && seen.add(type));
            if (index++ == 0) require(type.equals("basics") && !section.path("hidden").booleanValue());
            boolean data = Set.of("basics", "summary", "skills").contains(type);
            require(!section.has(data ? "items" : "data"));
            ((ObjectNode) section).retain("type", "hidden", data ? "data" : "items");
            if (data) {
                JsonNode fields = section.get("data");
                require(fields != null && fields.isObject());
                validateFields(fields, type);
            } else {
                JsonNode items = section.get("items");
                require(items != null && items.isArray() && items.size() <= 20);
                for (JsonNode item : items) validateFields(item, type);
            }
        }
        return clean;
    }

    private void validateFields(JsonNode fields, String type) {
        require(fields != null && fields.isObject());
        Set<String> allowed = new HashSet<>(STRINGS.get(type));
        for (String name : STRINGS.get(type)) {
            if (fields.has(name)) require(fields.get(name).isTextual());
        }
        if (type.equals("experience") || type.equals("education")) {
            allowed.add("current");
            if (fields.has("current")) require(fields.get("current").isBoolean());
        }
        if (type.equals("education") && fields.has("degree")) {
            require(Set.of("", "고졸", "학사", "석사", "박사").contains(fields.get("degree").textValue()));
        }
        if (type.equals("basics")) {
            allowed.addAll(Set.of("links", "photoId"));
            if (fields.has("photoId") && !fields.get("photoId").isNull()) {
                require(fields.get("photoId").isTextual());
                try {
                    String id = fields.get("photoId").textValue();
                    require(java.util.UUID.fromString(id).toString().equalsIgnoreCase(id));
                } catch (IllegalArgumentException exception) {
                    require(false);
                }
            }
            if (fields.has("links")) {
                JsonNode links = fields.get("links");
                require(links.isArray() && links.size() <= 3);
                for (JsonNode link : links) {
                    require(link.isObject());
                    for (String field : Set.of("label", "url")) {
                        if (link.has(field)) require(link.get(field).isTextual());
                    }
                    ((ObjectNode) link).retain("label", "url");
                }
            }
        }
        if (type.equals("skills")) {
            allowed.add("tags");
            if (fields.has("tags")) {
                JsonNode tags = fields.get("tags");
                require(tags.isArray() && tags.size() <= 30);
                for (JsonNode tag : tags) require(tag.isTextual());
            }
        }
        ((ObjectNode) fields).retain(allowed);
    }

    public JsonNode style(JsonNode style) {
        require(style != null && style.isObject());
        require(style.path("color").isTextual() && style.path("color").textValue().matches("#[0-9a-fA-F]{6}"));
        require(Set.of("pretendard", "noto-serif-kr").contains(style.path("font").asText()));
        require(Set.of("small", "medium", "large").contains(style.path("size").asText()));
        ObjectNode clean = style.deepCopy();
        clean.retain("color", "font", "size");
        return clean;
    }

    public String template(JsonNode template) {
        require(template != null && template.isTextual()
            && Set.of("classic", "modern").contains(template.textValue()));
        return template.textValue();
    }

    private void require(boolean valid) {
        if (!valid) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "이력서 구조가 올바르지 않습니다.", null);
    }
}
