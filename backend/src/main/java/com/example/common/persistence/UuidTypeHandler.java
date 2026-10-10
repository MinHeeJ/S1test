package com.example.common.persistence;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.UUID;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

/** Explicit native UUID binding for the shared PostgreSQL primary and ownership keys. */
@MappedTypes(UUID.class)
@MappedJdbcTypes(value = JdbcType.OTHER, includeNullJdbcType = true)
public class UuidTypeHandler extends BaseTypeHandler<UUID> {
    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, UUID value, JdbcType type)
        throws SQLException {
        statement.setObject(index, value, Types.OTHER);
    }

    @Override
    public UUID getNullableResult(ResultSet result, String name) throws SQLException {
        return result.getObject(name, UUID.class);
    }

    @Override
    public UUID getNullableResult(ResultSet result, int index) throws SQLException {
        return result.getObject(index, UUID.class);
    }

    @Override
    public UUID getNullableResult(CallableStatement result, int index) throws SQLException {
        return result.getObject(index, UUID.class);
    }
}
