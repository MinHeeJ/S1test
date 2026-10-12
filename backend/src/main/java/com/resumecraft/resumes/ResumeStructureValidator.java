package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Validates storage structure, not completeness, email or dates of an unfinished draft. */
@Component
public class ResumeStructureValidator {
    private static final Map<String, String> FIELDS = Map.of(
        "basics", "name jobTitle email phone",
        "summary", "headline body",
        "experience", "id company position start end description",
        "education", "id school major degree start end",
        "projects", "id name role start end description url",
        "certificates", "id name issuer date",
        "languages", "id language test score"
    );

    public void title(String title) {
        if (title == null || title.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) {
            invalid("title");
        }
    }

    public void template(String template) {
        if (!Set.of("classic", "modern").contains(template == null ? "" : template)) invalid("template");
    }

    /** Checks every hidden section as well; hiding preserves data rather than bypassing storage limits. */
    public void validate(ResumeWrite write) {
        title(write.title());
        template(write.template());
        JsonNode style = write.style();
        choice(style, "color", Set.of("#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151"), "style");
        choice(style, "font", Set.of("pretendard", "noto-serif-kr"), "style");
        choice(style, "size", Set.of("small", "medium", "large"), "style");
        JsonNode content = write.content();
        if (content == null || !content.isArray() || content.isEmpty() || content.size() > 8) invalid("content");
        if (content.toString().getBytes(StandardCharsets.UTF_8).length > 200000) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE",
                "본문 크기가 200KB를 초과합니다.", "content");
        }
        Set<String> types = new HashSet<>();
        for (int i = 0; i < content.size(); i++) {
            JsonNode section = content.get(i);
            String path = "content[" + i + "]";
            if (!section.isObject() || !section.path("type").isTextual()) invalid(path + ".type");
            String type = section.path("type").asText();
            if ((!FIELDS.containsKey(type) && !type.equals("skills")) || !types.add(type)) invalid(path + ".type");
            if (!section.path("hidden").isBoolean()) invalid(path + ".hidden");
            if (i == 0 && !type.equals("basics")) invalid(path + ".type");
            if (type.equals("basics") && (i != 0 || section.path("hidden").asBoolean())) invalid(path + ".hidden");
            if (Set.of("basics", "summary", "skills").contains(type)) {
                JsonNode data = section.path("data");
                if (!data.isObject()) invalid(path + ".data");
                if (type.equals("skills")) {
                    array(data.path("tags"), 30, path + ".data.tags");
                    for (JsonNode tag : data.path("tags")) if (!tag.isTextual()) invalid(path + ".data.tags");
                } else {
                    strings(data, FIELDS.get(type), path + ".data");
                }
                if (type.equals("basics")) {
                    array(data.path("links"), 3, path + ".data.links");
                    for (JsonNode link : data.path("links")) strings(link, "label url", path + ".data.links");
                    JsonNode photo = data.get("photoId");
                    if (photo == null || (!photo.isNull() && !photo.isTextual())) invalid(path + ".data.photoId");
                }
            } else {
                array(section.path("items"), 20, path + ".items");
                int j = 0;
                for (JsonNode item : section.path("items")) {
                    String itemPath = path + ".items[" + j++ + "]";
                    strings(item, FIELDS.get(type), itemPath);
                    if (type.equals("experience") || type.equals("education")) {
                        if (!item.path("current").isBoolean()) invalid(itemPath + ".current");
                    }
                    if (type.equals("education")) {
                        choice(item, "degree", Set.of("", "고졸", "학사", "석사", "박사"), itemPath);
                    }
                }
            }
        }
    }

    private void strings(JsonNode node, String fields, String path) {
        for (String field : fields.split(" ")) {
            if (!node.path(field).isTextual()) invalid(path + "." + field);
        }
    }

    private void array(JsonNode node, int maximum, String path) {
        if (!node.isArray() || node.size() > maximum) invalid(path);
    }

    private void choice(JsonNode node, String field, Set<String> choices, String path) {
        if (node == null || !node.isObject() || !node.path(field).isTextual()
            || !choices.contains(node.path(field).asText())) invalid(path + "." + field);
    }

    static void invalid(String field) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "입력 구조를 확인해주세요.", field);
    }
}
