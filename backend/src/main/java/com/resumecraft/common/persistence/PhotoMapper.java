package com.resumecraft.common.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.UUID;

/** Blocking XML adapter; owner predicates are enforced on every resource access. */
@Mapper
public interface PhotoMapper {
    PhotoRow findOwned(@Param("id") UUID id, @Param("userId") Long userId);

    int insert(@Param("id") UUID id, @Param("userId") Long userId,
            @Param("contentType") String contentType, @Param("data") byte[] data);
}
