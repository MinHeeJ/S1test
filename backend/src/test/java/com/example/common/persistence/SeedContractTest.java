package com.example.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class SeedContractTest extends PostgreSqlSupport {
    @Test
    void threeNamedAccountsHaveRealBcryptHashes() throws Exception {
        try (var statement = connection.createStatement(); var result = statement.executeQuery("""
            SELECT email, nickname, password_hash
            FROM users
            ORDER BY email
            """)) {
            int count = 0;
            var encoder = new BCryptPasswordEncoder();
            while (result.next()) {
                count++;
                assertThat(encoder.matches("demo1234", result.getString("password_hash"))).isTrue();
                assertThat(result.getString("nickname")).isIn("지우", "민준", "서연");
            }
            assertThat(count).isEqualTo(3);
        }
    }

    @Test
    void seedOwnershipTemplatesColorsAndSectionCountsAreDurable() throws Exception {
        try (var statement = connection.createStatement(); var result = statement.executeQuery("""
            SELECT u.email, r.title, r.template, r.style, r.content, r.deleted
            FROM resume r
            JOIN users u ON u.id = r.user_id
            ORDER BY u.email, r.title
            """)) {
            int count = 0;
            int jiwoo = 0;
            var mapper = new ObjectMapper();
            while (result.next()) {
                count++;
                var content = mapper.readTree(result.getString("content"));
                var style = mapper.readTree(result.getString("style"));
                assertThat(content.get(0).path("type").asText()).isEqualTo("basics");
                assertThat(content.get(0).path("data").path("photoId").isNull()).isTrue();
                assertThat(style.path("font").asText()).isEqualTo("pretendard");
                assertThat(style.path("size").asText()).isEqualTo("medium");
                if (result.getString("email").equals("jiwoo@resume.dev")) {
                    jiwoo++;
                    assertThat(result.getBoolean("deleted")).isFalse();
                    switch (result.getString("title")) {
                        case "백엔드 개발자 이력서" -> {
                            assertThat(content.size()).isEqualTo(8);
                            assertThat(result.getString("template")).isEqualTo("modern");
                            assertThat(style.path("color").asText()).isEqualTo("#1F3A5F");
                        }
                        case "신입 지원용" -> {
                            assertThat(content.size()).isEqualTo(5);
                            assertThat(content.get(2).path("items").size()).isEqualTo(1);
                            assertThat(content.get(3).path("data").path("tags").size()).isEqualTo(5);
                            assertThat(content.get(4).path("items").size()).isEqualTo(2);
                            assertThat(style.path("color").asText()).isEqualTo("#2563EB");
                        }
                        case "작성 중인 이력서" -> {
                            assertThat(content.size()).isEqualTo(2);
                            assertThat(content.get(0).path("data").path("jobTitle").asText()).isEmpty();
                            assertThat(content.get(1).path("hidden").asBoolean()).isTrue();
                            assertThat(content.get(1).path("items").size()).isEqualTo(1);
                            assertThat(style.path("color").asText()).isEqualTo("#374151");
                        }
                        default -> throw new AssertionError("Unexpected seed title");
                    }
                } else {
                    assertThat(result.getBoolean("deleted"))
                        .isEqualTo(result.getString("email").equals("seoyeon@resume.dev"));
                }
            }
            assertThat(count).isEqualTo(5);
            assertThat(jiwoo).isEqualTo(3);
        }
        try (var statement = connection.createStatement();
            var result = statement.executeQuery("SELECT COUNT(*) FROM photo")) {
            result.next();
            assertThat(result.getInt(1)).isZero();
        }
    }
}
