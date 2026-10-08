package com.resumecraft.common.persistence;

import java.util.UUID;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

/** UUID를 텍스트가 아닌 PostgreSQL UUID 객체로 바인딩한다. */
@MappedTypes(UUID.class)
public class UuidTypeHandler extends BaseTypeHandler<UUID> {
    @Override
    public void setNonNullParameter(PreparedStatement statement, int index, UUID value, JdbcType type)
            throws SQLException {
        statement.setObject(index, value);
    }

    @Override
    public UUID getNullableResult(ResultSet result, String column) throws SQLException {
        return result.getObject(column, UUID.class);
    }

    @Override
    public UUID getNullableResult(ResultSet result, int column) throws SQLException {
        return result.getObject(column, UUID.class);
    }

    @Override
    public UUID getNullableResult(CallableStatement statement, int column) throws SQLException {
        return statement.getObject(column, UUID.class);
    }
}
