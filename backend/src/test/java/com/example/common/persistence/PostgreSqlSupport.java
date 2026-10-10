package com.example.common.persistence;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;

/** Opt-in real PostgreSQL tests; absence of services skips before connection or context creation. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
abstract class PostgreSqlSupport {
    Connection connection;
    String schema;

    @BeforeAll
    void migrateIsolatedSchema() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent: real PostgreSQL round-trip deferred");
        String user = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "dev-only-password");
        schema = "resume_test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(url, user, password).schemas(schema).load().migrate();
        connection = DriverManager.getConnection(url, user, password);
        connection.setSchema(schema);
    }

    @AfterAll
    void removeIsolatedSchema() throws SQLException {
        if (connection != null) {
            try (var statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            } finally {
                connection.close();
            }
        }
    }
}
