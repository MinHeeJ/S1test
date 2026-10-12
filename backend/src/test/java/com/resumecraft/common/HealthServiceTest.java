package com.resumecraft.common;

import com.resumecraft.health.HealthService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class HealthServiceTest {
    DataSource source = mock(DataSource.class);
    Flyway flyway = mock(Flyway.class);
    MigrationInfoService info = mock(MigrationInfoService.class);
    Connection connection = mock(Connection.class);
    PreparedStatement statement = mock(PreparedStatement.class);
    ResultSet rows = mock(ResultSet.class);
    HealthService health = new HealthService(source, flyway);

    @BeforeEach
    void databaseAndAppliedMigration() throws Exception {
        when(source.getConnection()).thenReturn(connection);
        when(connection.prepareStatement("SELECT 1")).thenReturn(statement);
        when(statement.executeQuery()).thenReturn(rows);
        when(rows.next()).thenReturn(true);
        when(rows.getInt(1)).thenReturn(1);
        when(flyway.info()).thenReturn(info);
        when(info.pending()).thenReturn(new MigrationInfo[0]);
        when(info.current()).thenReturn(mock(MigrationInfo.class));
    }

    @Test
    void readinessExecutesSqlAndValidatesMigrations() throws Exception {
        health.requireReady();
        verify(statement).executeQuery();
        verify(flyway).validate();
        verify(connection).close();
    }

    @Test
    void missingDatabaseIsNotReady() throws Exception {
        when(source.getConnection()).thenThrow(new SQLException("private connection details"));
        assertThatThrownBy(health::requireReady).isInstanceOf(DomainException.class)
            .hasMessage("서비스 준비가 완료되지 않았습니다.");
        verifyNoInteractions(flyway);
    }

    @Test
    void unappliedMigrationIsNotReady() {
        when(info.pending()).thenReturn(new MigrationInfo[]{mock(MigrationInfo.class)});
        assertThatThrownBy(health::requireReady).isInstanceOf(DomainException.class);
    }

    @Test
    void noAppliedMigrationIsNotReady() {
        when(info.current()).thenReturn(null);
        assertThatThrownBy(health::requireReady).isInstanceOf(DomainException.class);
    }

    @Test
    void invalidMigrationIsNotReady() {
        doThrow(new IllegalStateException("checksum mismatch")).when(flyway).validate();
        assertThatThrownBy(health::requireReady).isInstanceOf(DomainException.class);
    }
}
