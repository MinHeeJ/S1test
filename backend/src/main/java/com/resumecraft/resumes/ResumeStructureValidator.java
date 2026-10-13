package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.DomainException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Enforces storage structure only; draft required values, email and dates are deliberately not validated. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, String> ITEM_FIELDS = Map.of(
            "experience", "id company position start end description",
            "education", "id school major degree start end",
            "projects", "id name role start end description url",
            "certificates", "id name issuer date",
            "languages", "id language test score"
    );
    private final ObjectMapper json;

    public ResumeStructureValidator(ObjectMapper json) {
        this.json = json;
    }

    public void title(String value) {
        if (value == null || value.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "400", "제목을 입력해 주세요.", "title");
        }
    }

    public void template(String value) {
        if (!Set.of("classic", "modern").contains(value == null ? "" : value)) {
            throw new DomainException(HttpStatus.BAD_REQUEST, "400", "템플릿을 확인해 주세요.", "template");
        }
    }

    /** Compact UTF-8 size applies only to content, never to the enclosing HTTP payload. */
    public void validate(ResumeWrite write) {
        title(write.title());
        template(write.template());
        JsonNode style = write.style();
        strings(style, "style", "color font size");
        allowed(style.get("color"), "style.color", Set.of(
                "#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151"));
        allowed(style.get("font"), "style.font", Set.of("pretendard", "noto-serif-kr"));
        allowed(style.get("size"), "style.size", Set.of("small", "medium", "large"));
        JsonNode content = write.content();
        array(content, "content", 8);
        if (content.isEmpty() || !"basics".equals(content.get(0).path("type").asText())) invalid("content");
        try {
            if (json.writeValueAsBytes(content).length > 200000) {
                throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE,
                        "CONTENT_TOO_LARGE", "본문은 200KB 이하로 저장해 주세요.", "content");
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            invalid("content");
        }
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < content.size(); i++) {
            JsonNode section = content.get(i);
            String path = "content[" + i + "]";
            strings(section, path, "type");
            bool(section.get("hidden"), path + ".hidden");
            String type = section.get("type").asText();
            if (!seen.add(type)) invalid(path + ".type");
            JsonNode data = section.get("data");
            switch (type) {
                case "basics" -> {
                    if (i != 0 || section.get("hidden").asBoolean()) invalid(path + ".hidden");
                    strings(data, path + ".data", "name jobTitle email phone");
                    array(data.get("links"), path + ".data.links", 3);
                    for (JsonNode link : data.get("links")) strings(link, path + ".data.links", "label url");
                    JsonNode photo = data.get("photoId");
                    if (photo == null || (!photo.isNull() && !photo.isTextual())) invalid(path + ".data.photoId");
                    if (!photo.isNull()) {
                        try {
                            if (!UUID.fromString(photo.asText()).toString().equalsIgnoreCase(photo.asText())) {
                                invalid(path + ".data.photoId");
                            }
                        } catch (IllegalArgumentException error) {
                            invalid(path + ".data.photoId");
                        }
                    }
                }
                case "summary" -> strings(data, path + ".data", "headline body");
                case "skills" -> {
                    if (data == null || !data.isObject()) invalid(path + ".data");
                    array(data.get("tags"), path + ".data.tags", 30);
                    for (JsonNode tag : data.get("tags")) if (!tag.isTextual()) invalid(path + ".data.tags");
                }
                default -> {
                    String fields = ITEM_FIELDS.get(type);
                    if (fields == null) invalid(path + ".type");
                    JsonNode items = section.get("items");
                    array(items, path + ".items", 20);
                    Set<String> ids = new HashSet<>();
                    for (int j = 0; j < items.size(); j++) {
                        JsonNode item = items.get(j);
                        String itemPath = path + ".items[" + j + "]";
                        strings(item, itemPath, fields);
                        if (!ids.add(item.get("id").asText())) invalid(itemPath + ".id");
                        if (type.equals("experience") || type.equals("education")) {
                            bool(item.get("current"), itemPath + ".current");
                        }
                        if (type.equals("education")) {
                            allowed(item.get("degree"), itemPath + ".degree", Set.of("", "고졸", "학사", "석사", "박사"));
                        }
                    }
                }
            }
        }
    }

    private void strings(JsonNode node, String path, String fields) {
        if (node == null || !node.isObject()) invalid(path);
        for (String field : fields.split(" ")) {
            if (!node.has(field) || !node.get(field).isTextual()) invalid(path + "." + field);
        }
    }

    private void bool(JsonNode node, String path) {
        if (node == null || !node.isBoolean()) invalid(path);
    }

    private void array(JsonNode node, String path, int max) {
        if (node == null || !node.isArray() || node.size() > max) invalid(path);
    }

    private void allowed(JsonNode node, String path, Set<String> values) {
        if (node == null || !node.isTextual() || !values.contains(node.asText())) invalid(path);
    }

    private void invalid(String path) {
        throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "구조를 확인해 주세요.", path);
    }
}
