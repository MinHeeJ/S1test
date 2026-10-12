package com.resumecraft.common.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.postgresql.util.PGobject;

/** Explicit JSONB binding preserving section order, nullable fields and unmodified string values. */
public class JsonbTypeHandler extends BaseTypeHandler<JsonNode> {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, JsonNode value, JdbcType type)
            throws SQLException {
        var json = new PGobject();
        json.setType("jsonb");
        json.setValue(value.toString());
        statement.setObject(index, json);
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
    public JsonNode getNullableResult(CallableStatement statement, int column) throws SQLException {
        return parse(statement.getString(column));
    }

    private JsonNode parse(String value) throws SQLException {
        if (value == null) {
            return null;
        }
        try {
            return JSON.readTree(value);
        } catch (JsonProcessingException error) {
            throw new SQLException("Stored JSON could not be decoded", error);
        }
    }
}
