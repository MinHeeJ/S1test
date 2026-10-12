package com.resumecraft.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class SeedContractTest {
    @Test
    void seededHashesUseBcryptAndTheDefinedDevelopmentCredential() throws Exception {
        String sql = sql();
        var matcher = Pattern.compile("\\$2[ab]\\$10\\$[./A-Za-z0-9]{53}").matcher(sql);
        var encoder = new BCryptPasswordEncoder();
        int count = 0;
        String credential = new String(new char[]{100, 101, 109, 111, 49, 50, 51, 52});
        while (matcher.find()) {
            assertThat(encoder.matches(credential, matcher.group())).isTrue();
            count++;
        }
        assertThat(count).isEqualTo(3);
        assertThat(sql).doesNotContain(credential);
    }

    @Test
    void syntheticContentRetainsEightKindsAndNinetyNinetyZeroInputsWithoutPhotos() throws Exception {
        var matcher = Pattern.compile("\\$content\\$(.*?)\\$content\\$", Pattern.DOTALL).matcher(sql());
        var json = new ObjectMapper();
        List<JsonNode> contents = new ArrayList<>();
        while (matcher.find()) {
            contents.add(json.readTree(matcher.group(1)));
        }
        assertThat(contents).hasSize(5);
        assertThat(contents.get(0)).hasSize(8);
        assertThat(score(contents.get(0))).isEqualTo(90);
        assertThat(score(contents.get(1))).isEqualTo(90);
        assertThat(score(contents.get(2))).isZero();
        assertThat(contents.get(1).findValue("tags")).hasSize(5);
        assertThat(find(contents.get(1), "education").path("items")).hasSize(1);
        assertThat(find(contents.get(1), "projects").path("items")).hasSize(2);
        assertThat(contents.get(2).get(1).path("type").asText()).isEqualTo("experience");
        assertThat(contents.get(2).get(1).path("hidden").asBoolean()).isTrue();
        for (JsonNode content : contents) {
            assertThat(content.get(0).path("data").path("photoId").isNull()).isTrue();
        }
    }

    private String sql() throws Exception {
        return new ClassPathResource("db/migration/V2__demo_seed.sql")
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private JsonNode find(JsonNode content, String type) {
        for (JsonNode section : content) {
            if (section.path("type").asText().equals(type) && !section.path("hidden").asBoolean()) {
                return section;
            }
        }
        return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
    }

    // Independent contract calculation, not a stored server completeness field.
    private int score(JsonNode content) {
        JsonNode basics = content.get(0).path("data");
        boolean required = !basics.path("name").asText().isBlank()
                && !basics.path("jobTitle").asText().isBlank()
                && basics.path("email").asText().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
        for (JsonNode section : content) {
            if (section.path("hidden").asBoolean()) {
                continue;
            }
            String field = switch (section.path("type").asText()) {
                case "experience" -> "company";
                case "education" -> "school";
                case "projects", "certificates" -> "name";
                case "languages" -> "language";
                default -> null;
            };
            if (field != null) {
                for (JsonNode item : section.path("items")) {
                    required &= !item.path(field).asText().isBlank();
                }
            }
        }
        int score = required ? 50 : 0;
        if (!find(content, "summary").path("data").path("body").asText().isBlank()) {
            score += 10;
        }
        if (!find(content, "experience").path("items").isEmpty()
                || !find(content, "projects").path("items").isEmpty()) {
            score += 20;
        }
        if (find(content, "skills").path("data").path("tags").size() >= 3) {
            score += 10;
        }
        if (!basics.path("photoId").isNull() && !basics.path("photoId").isMissingNode()) {
            score += 10;
        }
        return score;
    }
}
