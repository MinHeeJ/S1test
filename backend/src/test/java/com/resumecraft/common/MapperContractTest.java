package com.resumecraft.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.persistence.JsonbTypeHandler;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.postgresql.util.PGobject;
import org.springframework.core.io.ClassPathResource;

class MapperContractTest {
    @Test
    void xmlStatementsAndExplicitConstructorMappingsRegisterWithoutDatabase() throws Exception {
        var configuration = new Configuration();
        for (String name : new String[]{"User", "Resume", "Photo"}) {
            String resource = "mappers/common/" + name + "Mapper.xml";
            try (var input = new ClassPathResource(resource).getInputStream()) {
                new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
            }
            assertThat(configuration.hasStatement("com.resumecraft.common.persistence." + name + "Mapper.insert"))
                    .isTrue();
            assertThat(configuration.getResultMap("com.resumecraft.common.persistence." + name + "Mapper.row")
                    .getConstructorResultMappings()).isNotEmpty();
        }
    }

    @Test
    void jsonbBindingAndReadbackPreserveOrderNullsAndWarningOnlyStrings() throws Exception {
        var json = new ObjectMapper();
        var content = json.readTree("""
                [{"type":"basics","hidden":false,"data":{"photoId":null,"email":"abc@","jobTitle":""}},
                 {"type":"experience","hidden":true,"items":[{"start":"wrong","current":true}]}]
                """);
        var statement = mock(PreparedStatement.class);
        var handler = new JsonbTypeHandler();
        handler.setNonNullParameter(statement, 1, content, JdbcType.OTHER);
        var bound = ArgumentCaptor.forClass(PGobject.class);
        verify(statement).setObject(eq(1), bound.capture());
        assertThat(bound.getValue().getType()).isEqualTo("jsonb");
        var result = mock(ResultSet.class);
        when(result.getString("content")).thenReturn(bound.getValue().getValue());
        assertThat(handler.getNullableResult(result, "content")).isEqualTo(content);
        when(result.getString("content")).thenReturn(null);
        assertThat(handler.getNullableResult(result, "content")).isNull();
    }
}
