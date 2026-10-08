package com.resumecraft.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;
import java.io.IOException;
import org.apache.ibatis.type.*;

/** Lossless jsonb transport for object/array nodes; no business or date validation is performed. */
@MappedTypes(JsonNode.class)
@MappedJdbcTypes(value = JdbcType.OTHER, includeNullJdbcType = true)
public class JsonNodeTypeHandler extends BaseTypeHandler<JsonNode> {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, JsonNode value, JdbcType type) throws SQLException {
        ps.setObject(i, value.toString(), Types.OTHER);
    }

    private JsonNode parse(String value) throws SQLException {
        if (value == null) {
            return null;
        }
        try {
            return JSON.readTree(value);
        } catch (IOException error) {
            throw new SQLException("Invalid stored JSON", error);
        }
    }

    @Override
    public JsonNode getNullableResult(ResultSet rs, String column) throws SQLException {
        return parse(rs.getString(column));
    }

    @Override
    public JsonNode getNullableResult(ResultSet rs, int column) throws SQLException {
        return parse(rs.getString(column));
    }

    @Override
    public JsonNode getNullableResult(CallableStatement cs, int column) throws SQLException {
        return parse(cs.getString(column));
    }
}
