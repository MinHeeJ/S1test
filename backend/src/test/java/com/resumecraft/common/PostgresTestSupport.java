package com.resumecraft.common;

import java.util.UUID;
import javax.sql.DataSource;
import java.sql.Connection;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.postgresql.ds.PGSimpleDataSource;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.springframework.core.io.ClassPathResource;
import com.resumecraft.common.persistence.JsonbTypeHandler;
import com.resumecraft.common.persistence.UuidTypeHandler;

/** 전용 PostgreSQL 설정이 있을 때만 임시 schema에서 실제 migrations와 XML mapper를 실행한다. */
abstract class PostgresTestSupport {
    DataSource dataSource;
    String schema;
    SqlSessionFactory sessions;

    @BeforeEach
    void prepareDatabase() throws Exception {
        String url = System.getenv("TEST_DB_URL");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "TEST_DB_URL absent: real PostgreSQL test skipped");
        var source = new PGSimpleDataSource();
        source.setURL(url);
        source.setUser(System.getenv().getOrDefault("TEST_DB_USER", "postgres"));
        source.setPassword(System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
        schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = source.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
        }
        source.setCurrentSchema(schema);
        dataSource = source;
        Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").load().migrate();
        sessions = new SqlSessionFactoryBuilder().build(mapperConfiguration(dataSource));
    }

    static Configuration mapperConfiguration(DataSource source) throws Exception {
        var configuration = new Configuration(new Environment("test", new JdbcTransactionFactory(), source));
        configuration.setMapUnderscoreToCamelCase(true);
        configuration.getTypeHandlerRegistry().register(JsonbTypeHandler.class);
        configuration.getTypeHandlerRegistry().register(UuidTypeHandler.class);
        for (String resource : new String[]{
                "mappers/UserMapper.xml",
                "mappers/ResumeMapper.xml",
                "mappers/PhotoMapper.xml"}) {
            try (var stream = new ClassPathResource(resource).getInputStream()) {
                new XMLMapperBuilder(stream, configuration, resource, configuration.getSqlFragments()).parse();
            }
        }
        return configuration;
    }

    Connection connection() throws Exception {
        return dataSource.getConnection();
    }

    @AfterEach
    void discardDatabase() throws Exception {
        if (dataSource != null && schema != null) {
            try (var connection = connection(); var statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
}
