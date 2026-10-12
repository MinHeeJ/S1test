package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.JsonbTypeHandler;
import com.resumecraft.common.UuidTypeHandler;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.datasource.unpooled.UnpooledDataSource;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;
import static org.assertj.core.api.Assertions.assertThat;

/** Opt-in PostgreSQL materialization checks; ordinary contract tests do not require a database. */
@EnabledIfEnvironmentVariable(named = "TEST_DATABASE_URL", matches = ".+")
class ResumeMapperIntegrationTest {
    @Test
    void realXmlMaterializesSeedsAndPreservesJsonThroughOwnedWrites() throws Exception {
        String url = System.getenv("TEST_DATABASE_URL");
        String user = System.getenv("TEST_DATABASE_USER");
        String password = System.getenv("TEST_DATABASE_PASSWORD");
        Flyway.configure().dataSource(url, user, password).load().migrate();
        var source = new UnpooledDataSource("org.postgresql.Driver", url, user, password);
        var config = new Configuration(new Environment("postgresql", new JdbcTransactionFactory(), source));
        config.getTypeHandlerRegistry().register(JsonbTypeHandler.class);
        config.getTypeHandlerRegistry().register(UuidTypeHandler.class);
        try (var xml = new ClassPathResource("mappers/ResumeMapper.xml").getInputStream()) {
            new XMLMapperBuilder(xml, config, "mappers/ResumeMapper.xml", config.getSqlFragments()).parse();
        }
        try (var session = new SqlSessionFactoryBuilder().build(config).openSession(false)) {
            try {
                var mapper = session.getMapper(ResumeMapper.class);
                UUID owner = mapper.owner("jiwoo@resume.dev");
                UUID other = mapper.owner("minjun@resume.dev");
                assertThat(owner).isNotNull();
                assertThat(mapper.owner(owner.toString())).isEqualTo(owner);
                var list = mapper.list(owner);
                assertThat(list).hasSize(3);
                assertThat(mapper.list(other)).hasSize(1);
                assertThat(mapper.list(mapper.owner("seoyeon@resume.dev"))).isEmpty();
                Resume original = list.get(0);
                assertThat(original.style().get("color").isTextual()).isTrue();
                assertThat(original.content().get(0).path("data").get("photoId").isNull()).isTrue();
                assertThat(mapper.find(original.id(), other)).isNull();
                UUID id = UUID.randomUUID();
                var content = original.content().deepCopy();
                var style = new ObjectMapper().readTree(original.style().toString());
                var write = new ResumeWrite("원문 보존", original.template(), style, content);
                assertThat(mapper.insert(id, owner, write)).isEqualTo(1);
                Resume loaded = mapper.find(id, owner);
                assertThat(loaded.content()).isEqualTo(content);
                assertThat(loaded.style()).isEqualTo(style);
                assertThat(loaded.updatedAt()).isNotNull();
                assertThat(mapper.rename(id, other, "타인 수정")).isZero();
                assertThat(mapper.save(id, other, write)).isZero();
                assertThat(mapper.delete(id, other)).isZero();
                assertThat(mapper.rename(id, owner, "새 제목")).isEqualTo(1);
                assertThat(mapper.find(id, owner).content()).isEqualTo(content);
                assertThat(mapper.delete(id, owner)).isEqualTo(1);
                assertThat(mapper.find(id, owner)).isNull();
                assertThat(mapper.list(owner)).extracting(Resume::id).doesNotContain(id);
                assertThat(mapper.save(id, owner, write)).isZero();
                assertThat(mapper.delete(id, owner)).isZero();
                try (var statement = session.getConnection().prepareStatement(
                    "SELECT deleted FROM resume WHERE id = ?")) {
                    statement.setObject(1, id);
                    try (var result = statement.executeQuery()) {
                        assertThat(result.next()).isTrue();
                        assertThat(result.getBoolean(1)).isTrue();
                    }
                }
            } finally {
                session.rollback();
            }
        }
    }
}
