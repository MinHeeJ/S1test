package com.resumecraft.common;

import java.sql.*;
import java.util.UUID;
import org.apache.ibatis.type.*;

/** Maps application-issued UUIDs to native PostgreSQL uuid parameters and results. */
@MappedTypes(UUID.class)
@MappedJdbcTypes(value = JdbcType.OTHER, includeNullJdbcType = true)
public class UuidTypeHandler extends BaseTypeHandler<UUID> {
    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, UUID value, JdbcType type) throws SQLException {
        ps.setObject(i, value);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, String column) throws SQLException {
        return (UUID) rs.getObject(column);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, int column) throws SQLException {
        return (UUID) rs.getObject(column);
    }

    @Override
    public UUID getNullableResult(CallableStatement cs, int column) throws SQLException {
        return (UUID) cs.getObject(column);
    }
}
