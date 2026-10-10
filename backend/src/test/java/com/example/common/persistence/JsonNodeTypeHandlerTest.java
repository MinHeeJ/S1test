package com.example.common.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;

class JsonNodeTypeHandlerTest {
    @Test
    void partialHiddenJsonIsNotNormalizedDuringBindingOrReading() throws Exception {
        var json = new ObjectMapper().readTree("""
            [{"type":"basics","hidden":false,"data":{"jobTitle":"","email":"abc@","photoId":null}},
             {"type":"experience","hidden":true,"items":[{"start":"bad","end":"2020.01","current":true}]}]
            """);
        var handler = new JsonNodeTypeHandler();
        var statement = mock(PreparedStatement.class);
        handler.setNonNullParameter(statement, 1, json, JdbcType.OTHER);
        verify(statement).setObject(1, json.toString(), Types.OTHER);
        var result = mock(ResultSet.class);
        when(result.getString("content")).thenReturn(json.toString());
        assertThat(handler.getNullableResult(result, "content")).isEqualTo(json);
    }

    @Test
    void sqlNullRemainsNull() throws Exception {
        assertThat(new JsonNodeTypeHandler().getNullableResult(mock(ResultSet.class), "content")).isNull();
    }

    @Test
    void corruptStoredJsonIsNotSilentlyReplacedByEmptyContent() throws Exception {
        var result = mock(ResultSet.class);
        when(result.getString("content")).thenReturn("not json");
        assertThatThrownBy(() -> new JsonNodeTypeHandler().getNullableResult(result, "content"))
            .isInstanceOf(SQLException.class);
    }
}
