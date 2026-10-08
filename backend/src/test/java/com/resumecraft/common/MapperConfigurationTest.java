package com.resumecraft.common;

import org.junit.jupiter.api.Test;
import org.postgresql.ds.PGSimpleDataSource;
import com.resumecraft.common.persistence.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

class MapperConfigurationTest {
    @Test
    void actualXmlMapsEveryDeclaredAdapterAndConstructorWithoutConnectingToDb() throws Exception {
        var configuration = PostgresTestSupport.mapperConfiguration(new PGSimpleDataSource());
        for (Class<?> mapper : new Class<?>[]{UserMapper.class, ResumeMapper.class, PhotoMapper.class}) {
            for (var method : mapper.getDeclaredMethods()) {
                assertThat(configuration.hasStatement(mapper.getName() + "." + method.getName())).isTrue();
            }
        }
    }

    @Test
    void jsonbHandlerBindsTypedPgobjectAndPreservesNullableFields() throws Exception {
        var handler = new JsonbTypeHandler();
        var json = new ObjectMapper().readTree("""
                [{"type":"basics","hidden":false,"data":{"photoId":null}},
                 {"type":"summary","hidden":true,"data":{"body":"숨김 보존"}}]
                """);
        var statement = mock(PreparedStatement.class);
        handler.setNonNullParameter(statement, 1, json, org.apache.ibatis.type.JdbcType.OTHER);
        var bound = ArgumentCaptor.forClass(PGobject.class);
        verify(statement).setObject(eq(1), bound.capture());
        assertThat(bound.getValue().getType()).isEqualTo("jsonb");
        var result = mock(ResultSet.class);
        when(result.getString("content")).thenReturn(bound.getValue().getValue());
        assertThat(handler.getNullableResult(result, "content")).isEqualTo(json);
        when(result.getString("content")).thenReturn(null);
        assertThat(handler.getNullableResult(result, "content")).isNull();
    }
}
