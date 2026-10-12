package com.resumecraft.auth;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Reads authentication accounts and inserts only the account created by signup. */
@Mapper
public interface AuthMapper {
    AuthAccount findByEmail(@Param("email") String email);
    AuthAccount findById(@Param("id") UUID id);
    int insert(AuthAccount account);
}
