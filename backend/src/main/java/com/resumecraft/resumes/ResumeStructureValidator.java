package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.ApiException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Validates structural safety only: unfinished user text is intentionally saveable. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, String[]> FIELDS = Map.of(
            "basics", new String[]{"name", "jobTitle", "email", "phone"},
            "summary", new String[]{"headline", "body"},
            "skills", new String[]{},
            "experience", new String[]{"id", "company", "position", "start", "end", "description"},
            "education", new String[]{"id", "school", "major", "degree", "start", "end"},
            "projects", new String[]{"id", "name", "role", "start", "end", "description", "url"},
            "certificates", new String[]{"id", "name", "issuer", "date"},
            "languages", new String[]{"id", "language", "test", "score"});
    private final ObjectMapper json;

    public ResumeStructureValidator(ObjectMapper json) {
        this.json = json;
    }

    /** Measures compact UTF-8 template/style/content, never title or immutable request extras. */
    public void validate(UpdateResumeInput input) {
        var document = json.createObjectNode();
        document.set("template", input.template());
        document.set("style", input.style());
        document.set("content", input.content());
        try {
            if (json.writeValueAsBytes(document).length > 200000) {
                throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE",
                        "本文 크기 제한을 초과했습니다.", "content");
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            invalid("content");
        }
        template(input.template(), "INVALID_STRUCTURE");
        JsonNode style = input.style();
        require(style != null && style.isObject(), "style");
        require(style.path("color").isTextual()
                && style.path("color").asText().matches("#[0-9a-fA-F]{6}"), "style.color");
        require(Set.of("pretendard", "noto-serif-kr").contains(style.path("font").asText()), "style.font");
        require(Set.of("small", "medium", "large").contains(style.path("size").asText()), "style.size");
        JsonNode content = input.content();
        require(content != null && content.isArray() && content.size() >= 1 && content.size() <= 8, "content");
        require("basics".equals(content.get(0).path("type").asText())
                && content.get(0).path("hidden").isBoolean()
                && !content.get(0).path("hidden").asBoolean(), "content[0]");
        Set<String> seen = new HashSet<>();
        for (int index = 0; index < content.size(); index++) {
            JsonNode section = content.get(index);
            String path = "content[" + index + "]";
            String type = section.path("type").asText();
            require(section.isObject() && FIELDS.containsKey(type) && seen.add(type), path + ".type");
            require(section.path("hidden").isBoolean(), path + ".hidden");
            if (Set.of("basics", "summary", "skills").contains(type)) {
                JsonNode data = section.path("data");
                require(data.isObject() && !section.has("items"), path + ".data");
                strings(data, FIELDS.get(type), path + ".data");
                if (type.equals("basics")) {
                    optionalArray(data, "links", 3, path + ".data");
                    if (data.has("links")) {
                        for (JsonNode link : data.get("links")) {
                            require(link.isObject(), path + ".data.links");
                            strings(link, new String[]{"label", "url"}, path + ".data.links");
                        }
                    }
                    if (data.has("photoId") && !data.get("photoId").isNull()) {
                        require(data.get("photoId").isTextual(), path + ".data.photoId");
                        try {
                            java.util.UUID.fromString(data.get("photoId").asText());
                        } catch (IllegalArgumentException error) {
                            invalid(path + ".data.photoId");
                        }
                    }
                }
                if (type.equals("skills")) {
                    optionalArray(data, "tags", 30, path + ".data");
                    if (data.has("tags")) {
                        for (JsonNode tag : data.get("tags")) {
                            require(tag.isTextual(), path + ".data.tags");
                        }
                    }
                }
            } else {
                require(section.path("items").isArray() && section.path("items").size() <= 20
                        && !section.has("data"), path + ".items");
                for (JsonNode item : section.get("items")) {
                    require(item.isObject(), path + ".items");
                    strings(item, FIELDS.get(type), path + ".items");
                    if (Set.of("experience", "education").contains(type) && item.has("current")) {
                        require(item.get("current").isBoolean(), path + ".items.current");
                    }
                    if (type.equals("education") && item.has("degree")) {
                        require(Set.of("", "고졸", "학사", "석사", "박사").contains(item.get("degree").asText()),
                                path + ".items.degree");
                    }
                }
            }
        }
    }

    public String template(JsonNode value, String code) {
        if (value == null || !value.isTextual() || !Set.of("classic", "modern").contains(value.asText())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, "템플릿을 확인해 주세요.", "template");
        }
        return value.asText();
    }

    public String title(JsonNode value) {
        if (value == null || !value.isTextual() || value.asText().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "400", "제목을 입력해 주세요.", "title");
        }
        return value.asText();
    }

    private void strings(JsonNode object, String[] fields, String path) {
        for (String field : fields) {
            require(!object.has(field) || object.get(field).isTextual(), path + "." + field);
        }
    }

    private void optionalArray(JsonNode object, String field, int max, String path) {
        require(!object.has(field) || (object.get(field).isArray() && object.get(field).size() <= max),
                path + "." + field);
    }

    private void require(boolean condition, String field) {
        if (!condition) {
            invalid(field);
        }
    }

    private void invalid(String field) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "본문 구조를 확인해 주세요.", field);
    }
}
