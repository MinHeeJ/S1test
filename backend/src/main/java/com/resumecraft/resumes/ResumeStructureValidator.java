package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** 保存時は構造のみ検査し、入力途中の必須値・メール・日付では保存を妨げない。 */
@Component
public class ResumeStructureValidator {
    private static final Map<String, String> FIELDS = Map.of(
            "basics", "name jobTitle email phone",
            "summary", "headline body",
            "experience", "id company position start end description",
            "education", "id school major degree start end",
            "projects", "id name role start end description url",
            "certificates", "id name issuer date",
            "languages", "id language test score",
            "skills", "");

    /** 전체 교체 payload의 필수 구조와 허용 enum만 검증한다. */
    public void validate(JsonNode body) {
        object(body, null);
        template(body.get("template"));
        JsonNode style = body.path("style");
        object(style, "style");
        enumValue(style.get("font"), Set.of("pretendard", "noto-serif-kr"), "style.font");
        enumValue(style.get("size"), Set.of("small", "medium", "large"), "style.size");
        if (!style.path("color").isTextual() || !style.path("color").asText().matches("#[0-9a-fA-F]{6}")) {
            invalid("style.color");
        }
        JsonNode content = body.path("content");
        array(content, 8, "content");
        if (content.isEmpty()) invalid("content");
        Set<String> seen = new HashSet<>();
        for (int index = 0; index < content.size(); index++) {
            JsonNode section = content.get(index);
            String path = "content[" + index + "]";
            object(section, path);
            String type = section.path("type").asText();
            if (!FIELDS.containsKey(type) || !seen.add(type)) invalid(path + ".type");
            if (!section.path("hidden").isBoolean()) invalid(path + ".hidden");
            if (index == 0 && !"basics".equals(type)) invalid(path + ".type");
            if ("basics".equals(type) && section.path("hidden").asBoolean()) invalid(path + ".hidden");
            boolean dataSection = Set.of("basics", "summary", "skills").contains(type);
            if (section.has(dataSection ? "items" : "data")) invalid(path);
            if (dataSection) {
                JsonNode data = section.path("data");
                object(data, path + ".data");
                strings(data, FIELDS.get(type), path + ".data");
                if ("basics".equals(type)) basics(data, path + ".data");
                if ("skills".equals(type) && data.has("tags")) {
                    array(data.get("tags"), 30, path + ".data.tags");
                    for (JsonNode tag : data.get("tags")) {
                        if (!tag.isTextual()) invalid(path + ".data.tags");
                    }
                }
            } else {
                JsonNode items = section.path("items");
                array(items, 20, path + ".items");
                for (int i = 0; i < items.size(); i++) {
                    JsonNode item = items.get(i);
                    String itemPath = path + ".items[" + i + "]";
                    object(item, itemPath);
                    strings(item, FIELDS.get(type), itemPath);
                    if (Set.of("education", "experience").contains(type) && item.has("current")
                            && !item.get("current").isBoolean()) invalid(itemPath + ".current");
                    if ("education".equals(type) && item.has("degree")) {
                        enumValue(item.get("degree"), Set.of("", "고졸", "학사", "석사", "박사"), itemPath + ".degree");
                    }
                }
            }
        }
    }

    public void template(JsonNode value) {
        enumValue(value, Set.of("classic", "modern"), "template");
    }

    private void basics(JsonNode data, String path) {
        if (data.has("links")) {
            array(data.get("links"), 3, path + ".links");
            for (JsonNode link : data.get("links")) {
                object(link, path + ".links");
                strings(link, "label url", path + ".links");
            }
        }
        if (data.hasNonNull("photoId")) {
            if (!data.get("photoId").isTextual()) invalid(path + ".photoId");
            try {
                java.util.UUID.fromString(data.get("photoId").asText());
            } catch (IllegalArgumentException exception) {
                invalid(path + ".photoId");
            }
        }
    }

    private void strings(JsonNode node, String fields, String path) {
        for (String field : fields.split(" ")) {
            if (!field.isEmpty() && node.has(field) && !node.get(field).isTextual()) invalid(path + "." + field);
        }
    }

    private void object(JsonNode value, String path) {
        if (value == null || !value.isObject()) invalid(path);
    }

    private void array(JsonNode value, int max, String path) {
        if (value == null || !value.isArray() || value.size() > max) invalid(path);
    }

    private void enumValue(JsonNode value, Set<String> values, String path) {
        if (value == null || !value.isTextual() || !values.contains(value.asText())) invalid(path);
    }

    private void invalid(String path) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "이력서 구조를 확인해주세요.", path);
    }
}
