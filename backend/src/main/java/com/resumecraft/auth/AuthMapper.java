package com.resumecraft.auth;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Typed account access through the existing users schema and paired XML statements. */
@Mapper
public interface AuthMapper {
    AuthAccount findByEmail(@Param("email") String email);

    AuthAccount findById(@Param("id") UUID id);

    int insert(AuthAccount account);
}
