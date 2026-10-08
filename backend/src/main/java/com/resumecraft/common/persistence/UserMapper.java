package com.resumecraft.common.persistence;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking account persistence; email uniqueness remains enforced by PostgreSQL. */
@Mapper
public interface UserMapper {
    UserRow findByEmail(@Param("email") String email);
    UserRow findById(@Param("id") UUID id);
    int insert(UserRow row);
}
