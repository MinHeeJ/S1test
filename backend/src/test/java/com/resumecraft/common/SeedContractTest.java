package com.resumecraft.common;

import java.sql.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class SeedContractTest {
    @Test
    void seededActorsAndResumeScopesAreConsistent() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        String user = System.getenv("TEST_DB_USER");
        String password = System.getenv("TEST_DB_PASSWORD");
        String schema = "seed_" + UUID.randomUUID().toString().replace("-", "");
        var flyway = Flyway.configure().dataSource(url, user, password).schemas(schema)
                .locations("classpath:db/migration").cleanDisabled(false).load();
        try {
            flyway.migrate();
            try (Connection db = DriverManager.getConnection(url, user, password)) {
                db.setSchema(schema);
                try (var query = db.createStatement(); var rows = query.executeQuery(
                        "SELECT email, nickname, password_hash FROM users ORDER BY email")) {
                    int count = 0;
                    while (rows.next()) {
                        assertThat(new BCryptPasswordEncoder().matches("demo1234", rows.getString("password_hash")))
                                .isTrue();
                        count++;
                    }
                    assertThat(count).isEqualTo(3);
                }
                try (var query = db.createStatement(); var rows = query.executeQuery("""
                        SELECT u.email, COUNT(r.id) AS total
                        FROM users u
                        JOIN resume r ON r.user_id = u.id
                        GROUP BY u.email
                        ORDER BY u.email
                        """)) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString("email")).isEqualTo("jiwoo@resume.dev");
                    assertThat(rows.getInt("total")).isEqualTo(3);
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString("email")).isEqualTo("minjun@resume.dev");
                    assertThat(rows.getInt("total")).isEqualTo(1);
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString("email")).isEqualTo("seoyeon@resume.dev");
                    assertThat(rows.getInt("total")).isEqualTo(1);
                }
                try (var query = db.createStatement(); var rows = query.executeQuery("""
                        SELECT COUNT(*) AS total
                        FROM resume r
                        JOIN users u ON u.id = r.user_id
                        WHERE u.email = 'seoyeon@resume.dev' AND r.deleted = true
                        """)) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getInt("total")).isEqualTo(1);
                }
                try (var query = db.createStatement(); var rows = query.executeQuery("SELECT COUNT(*) FROM photo")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getInt(1)).isZero();
                }
            }
        } finally {
            flyway.clean();
        }
    }
}
