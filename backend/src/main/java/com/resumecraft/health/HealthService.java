package com.resumecraft.health;

import com.resumecraft.common.DomainException;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Readiness requires an actual DB query and a valid, fully applied Flyway chain. */
@Service
public class HealthService {
    private final DataSource dataSource;
    private final Flyway flyway;

    public HealthService(DataSource dataSource, Flyway flyway) {
        this.dataSource = dataSource;
        this.flyway = flyway;
    }

    public void requireReady() {
        try (var connection = dataSource.getConnection();
                var statement = connection.prepareStatement("SELECT 1");
                var rows = statement.executeQuery()) {
            flyway.validate();
            if (!rows.next() || rows.getInt(1) != 1
                    || flyway.info().pending().length != 0
                    || flyway.info().current() == null) {
                throw new IllegalStateException("Readiness incomplete");
            }
        } catch (Exception exception) {
            throw new DomainException(HttpStatus.SERVICE_UNAVAILABLE,
                "SERVICE_UNAVAILABLE", "서비스 준비가 완료되지 않았습니다.");
        }
    }
}
