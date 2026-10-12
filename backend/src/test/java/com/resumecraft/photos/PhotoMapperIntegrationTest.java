package com.resumecraft.photos;

import com.resumecraft.common.UuidTypeHandler;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.apache.ibatis.session.Configuration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.assertThat;

/** Opt-in PostgreSQL execution of the real XML mapper, including bytea and UUID record materialization. */
@EnabledIfEnvironmentVariable(named = "TEST_DATABASE_URL", matches = ".+")
class PhotoMapperIntegrationTest {
    @Test
    void originalBytesAndOwnerPredicateRoundtrip() throws Exception {
        String url = System.getenv("TEST_DATABASE_URL");
        String user = System.getenv("TEST_DATABASE_USER");
        String password = System.getenv("TEST_DATABASE_PASSWORD");
        Flyway.configure().dataSource(url, user, password).load().migrate();
        var factory = new SqlSessionFactoryBean();
        factory.setDataSource(new DriverManagerDataSource(url, user, password));
        var configuration = new Configuration();
        configuration.getTypeHandlerRegistry().register(UuidTypeHandler.class);
        factory.setConfiguration(configuration);
        factory.setMapperLocations(new ClassPathResource("mappers/PhotoMapper.xml"));
        try (var session = factory.getObject().openSession(false)) {
            try {
                UUID owner = UUID.randomUUID();
                String email = owner + "@example.test";
                try (var insert = session.getConnection().prepareStatement("""
                    INSERT INTO users (id, email, nickname, password_hash)
                    VALUES (?, ?, '시험', 'test-only-hash')
                    """)) {
                    insert.setObject(1, owner);
                    insert.setString(2, email);
                    insert.executeUpdate();
                }
                PhotoMapper mapper = session.getMapper(PhotoMapper.class);
                assertThat(mapper.selectUserId(email)).isEqualTo(owner);
                assertThat(mapper.selectUserId(owner.toString())).isEqualTo(owner);
                assertThat(mapper.selectUserId("missing@example.test")).isNull();
                UUID id = UUID.randomUUID();
                byte[] bytes = {0, 1, -1, 42};
                OffsetDateTime created = OffsetDateTime.now(ZoneOffset.UTC).withNano(0);
                assertThat(mapper.insert(new Photo(id, owner, "image/png", bytes, created))).isEqualTo(1);
                Photo loaded = mapper.findOwned(id, owner);
                assertThat(loaded.id()).isEqualTo(id);
                assertThat(loaded.userId()).isEqualTo(owner);
                assertThat(loaded.contentType()).isEqualTo("image/png");
                assertThat(loaded.data()).isEqualTo(bytes);
                assertThat(loaded.createdAt().toInstant()).isEqualTo(created.toInstant());
                assertThat(mapper.findOwned(id, UUID.randomUUID())).isNull();
                assertThat(mapper.findOwned(UUID.randomUUID(), owner)).isNull();
            } finally {
                session.rollback();
            }
        }
    }
}
