package com.resumecraft.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;
import java.sql.*;
import java.io.IOException;

/** Maps JSON trees to PostgreSQL jsonb, preserving arrays, nulls and user strings. */
@MappedTypes(JsonNode.class)
@MappedJdbcTypes(value = JdbcType.OTHER, includeNullJdbcType = true)
public class JsonbTypeHandler extends BaseTypeHandler<JsonNode> {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, JsonNode value, JdbcType type)
        throws SQLException {
        statement.setObject(index, value.toString(), Types.OTHER);
    }

    @Override
    public JsonNode getNullableResult(ResultSet result, String column) throws SQLException {
        return parse(result.getString(column));
    }

    @Override
    public JsonNode getNullableResult(ResultSet result, int column) throws SQLException {
        return parse(result.getString(column));
    }

    @Override
    public JsonNode getNullableResult(CallableStatement result, int column) throws SQLException {
        return parse(result.getString(column));
    }

    private JsonNode parse(String value) throws SQLException {
        if (value == null) return null;
        try {
            return JSON.readTree(value);
        } catch (IOException error) {
            throw new SQLException("Invalid jsonb value", error);
        }
    }
}
