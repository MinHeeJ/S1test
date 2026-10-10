package com.example.auth;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** XML-only access to users; login reads and never modifies stored credentials. */
@Mapper
public interface AuthMapper {
    AuthUser findByEmail(@Param("email") String email);
    AuthUser findById(@Param("id") UUID id);
    int insert(AuthUser user);
}
