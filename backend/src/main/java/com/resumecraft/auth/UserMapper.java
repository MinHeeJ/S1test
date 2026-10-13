package com.resumecraft.auth;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Database-only account adapter, backed by UserMapper.xml and the users unique key. */
@Mapper
public interface UserMapper {
    UserRow findByEmail(@Param("email") String email);

    UserRow findById(@Param("id") Long id);

    /** Returns the INSERT-generated identity without relying on a subsequent scoped read. */
    Long insert(
            @Param("email") String email,
            @Param("nickname") String nickname,
            @Param("passwordHash") String passwordHash
    );
}
