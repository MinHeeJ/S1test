package com.resumecraft.common;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;

/** Opt-in disposable PostgreSQL schema; callers must set TEST_DB_URL to a test database, never production. */
abstract class PostgresTestDatabase {
    static Connection database;
    static String schema;

    @BeforeAll
    static void migrate() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        String user = System.getenv().getOrDefault("TEST_DB_USER", "resumecraft");
        String password = System.getenv().getOrDefault("TEST_DB_PASSWORD", "");
        schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(url, user, password).schemas(schema).defaultSchema(schema)
            .locations("classpath:db/migration").load().migrate();
        database = DriverManager.getConnection(url, user, password);
        database.createStatement().execute("SET search_path TO " + schema + ", public");
    }

    @AfterAll
    static void clean() throws Exception {
        if (database != null) {
            try (var statement = database.createStatement()) {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            } finally {
                database.close();
            }
        }
    }
}
