package com.example.common.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

/** Round-trips PostgreSQL jsonb trees without converting section order or hidden values. */
@MappedTypes(JsonNode.class)
@MappedJdbcTypes(value = JdbcType.OTHER, includeNullJdbcType = true)
public class JsonNodeTypeHandler extends BaseTypeHandler<JsonNode> {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, JsonNode value, JdbcType type)
        throws SQLException {
        statement.setObject(index, value.toString(), Types.OTHER);
    }

    @Override
    public JsonNode getNullableResult(ResultSet result, String name) throws SQLException {
        return parse(result.getString(name));
    }

    @Override
    public JsonNode getNullableResult(ResultSet result, int index) throws SQLException {
        return parse(result.getString(index));
    }

    @Override
    public JsonNode getNullableResult(CallableStatement result, int index) throws SQLException {
        return parse(result.getString(index));
    }

    private JsonNode parse(String value) throws SQLException {
        if (value == null) {
            return null;
        }
        try {
            return JSON.readTree(value);
        } catch (java.io.IOException exception) {
            throw new SQLException("Stored JSON could not be decoded", exception);
        }
    }
}
