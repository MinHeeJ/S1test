package com.example.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.UUID;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;

class UuidTypeHandlerTest {
    @Test
    void bindsAndReadsNativeUuidWithoutStringCoercion() throws Exception {
        var id = UUID.randomUUID();
        var statement = mock(PreparedStatement.class);
        var handler = new UuidTypeHandler();
        handler.setNonNullParameter(statement, 2, id, JdbcType.OTHER);
        verify(statement).setObject(2, id, Types.OTHER);
        var result = mock(ResultSet.class);
        when(result.getObject("id", UUID.class)).thenReturn(id);
        assertThat(handler.getNullableResult(result, "id")).isEqualTo(id);
    }

    @Test
    void sqlNullUuidRemainsNull() throws Exception {
        assertThat(new UuidTypeHandler().getNullableResult(mock(ResultSet.class), "id")).isNull();
    }
}
