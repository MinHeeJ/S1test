package com.resumecraft.common.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking XML adapter; owner predicates are enforced on every resource access. */
@Mapper
public interface UserMapper {
    UserRow findByEmail(@Param("email") String email);

    UserRow findById(@Param("id") Long id);

    /** Returns the committed candidate key; the feature service owns the transaction. */
    Long insert(@Param("email") String email, @Param("nickname") String nickname,
            @Param("passwordHash") String passwordHash);
}
