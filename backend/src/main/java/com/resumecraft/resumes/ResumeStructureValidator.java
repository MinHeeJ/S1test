package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.DomainException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Checks only storage structure, never frontend-required values, email format or date warnings. */
@Component
public class ResumeStructureValidator {
    private static final Set<String> TYPES = Set.of(
        "basics", "summary", "experience", "education", "skills", "projects", "certificates", "languages"
    );
    private static final Map<String, String[]> ITEM_FIELDS = Map.of(
        "experience", new String[]{"id", "company", "position", "start", "end", "description"},
        "education", new String[]{"id", "school", "major", "degree", "start", "end"},
        "projects", new String[]{"id", "name", "role", "start", "end", "description", "url"},
        "certificates", new String[]{"id", "name", "issuer", "date"},
        "languages", new String[]{"id", "language", "test", "score"}
    );

    /** Unicode whitespace-only titles are invalid, but a valid title is preserved verbatim. */
    public String title(JsonNode value) {
        if (value == null || !value.isTextual() || value.textValue().codePoints().allMatch(
                point -> Character.isWhitespace(point) || Character.isSpaceChar(point) || point == 0x85)) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "제목을 입력해 주세요.", "title");
        }
        return value.textValue();
    }

    public String template(JsonNode value) {
        if (value == null || !value.isTextual() || !Set.of("classic", "modern").contains(value.textValue())) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "템플릿을 확인해 주세요.", "template");
        }
        return value.textValue();
    }

    public ResumeWrite validate(JsonNode request) {
        String title = title(request.get("title"));
        String template = template(request.get("template"));
        JsonNode style = request.path("style");
        allowed(style, "color", Set.of("#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151"), "style");
        allowed(style, "font", Set.of("pretendard", "noto-serif-kr"), "style");
        allowed(style, "size", Set.of("small", "medium", "large"), "style");
        JsonNode content = request.path("content");
        if (!content.isArray() || content.isEmpty() || content.size() > 8) {
            invalid("content");
        }
        // Only the compact content array counts towards the agreed UTF-8 byte budget.
        if (content.toString().getBytes(StandardCharsets.UTF_8).length > 200000) {
            throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE,
                "CONTENT_TOO_LARGE", "이력서 본문 크기를 줄여 주세요.", "content");
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < content.size(); i++) {
            JsonNode section = content.get(i);
            String path = "content[" + i + "]";
            allowed(section, "type", TYPES, path);
            String type = section.get("type").textValue();
            if (!seen.add(type)) {
                invalid(path + ".type");
            }
            bool(section, "hidden", path);
            if ((i == 0 && !type.equals("basics")) || (type.equals("basics")
                    && (i != 0 || section.get("hidden").booleanValue()))) {
                invalid(path + (type.equals("basics") ? ".hidden" : ".type"));
            }
            if (type.equals("basics")) {
                JsonNode data = section.path("data");
                strings(data, new String[]{"name", "jobTitle", "email", "phone"}, path + ".data");
                JsonNode photo = data.get("photoId");
                if (photo == null || (!photo.isNull() && !photo.isTextual())) {
                    invalid(path + ".data.photoId");
                }
                if (photo != null && photo.isTextual()) {
                    try {
                        java.util.UUID.fromString(photo.textValue());
                    } catch (IllegalArgumentException exception) {
                        invalid(path + ".data.photoId");
                    }
                }
                JsonNode links = data.path("links");
                array(links, 3, path + ".data.links");
                for (int j = 0; j < links.size(); j++) {
                    strings(links.get(j), new String[]{"label", "url"}, path + ".data.links[" + j + "]");
                }
            } else if (type.equals("summary")) {
                strings(section.path("data"), new String[]{"headline", "body"}, path + ".data");
            } else if (type.equals("skills")) {
                JsonNode tags = section.path("data").path("tags");
                array(tags, 30, path + ".data.tags");
                for (int j = 0; j < tags.size(); j++) {
                    if (!tags.get(j).isTextual()) {
                        invalid(path + ".data.tags[" + j + "]");
                    }
                }
            } else {
                JsonNode items = section.path("items");
                array(items, 20, path + ".items");
                for (int j = 0; j < items.size(); j++) {
                    String itemPath = path + ".items[" + j + "]";
                    strings(items.get(j), ITEM_FIELDS.get(type), itemPath);
                    if (type.equals("experience") || type.equals("education")) {
                        bool(items.get(j), "current", itemPath);
                    }
                    if (type.equals("education")) {
                        allowed(items.get(j), "degree", Set.of("", "고졸", "학사", "석사", "박사"), itemPath);
                    }
                }
            }
        }
        return new ResumeWrite(title, template, style, content);
    }

    private void array(JsonNode node, int maximum, String path) {
        if (!node.isArray() || node.size() > maximum) {
            invalid(path);
        }
    }

    private void strings(JsonNode node, String[] fields, String path) {
        for (String field : fields) {
            if (!node.path(field).isTextual()) {
                invalid(path + "." + field);
            }
        }
    }

    private void bool(JsonNode node, String field, String path) {
        if (!node.path(field).isBoolean()) {
            invalid(path + "." + field);
        }
    }

    private void allowed(JsonNode node, String field, Set<String> values, String path) {
        if (!node.path(field).isTextual() || !values.contains(node.path(field).textValue())) {
            invalid(path + "." + field);
        }
    }

    private void invalid(String field) {
        throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "이력서 구조를 확인해 주세요.", field);
    }
}
