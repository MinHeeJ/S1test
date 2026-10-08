package com.resumecraft.auth;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking users access; the unique email constraint arbitrates concurrent signup. */
@Mapper
public interface AuthUserMapper {
    AuthAccount findByEmail(@Param("email") String email);
    int insert(AuthAccount account);
}
