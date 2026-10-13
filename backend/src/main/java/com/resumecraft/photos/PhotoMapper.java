package com.resumecraft.photos;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Stores original bytea and scopes all photo reads to the authenticated owner. */
@Mapper
public interface PhotoMapper {
    int insert(PhotoRow photo);

    PhotoRow findOwned(@Param("id") String id, @Param("userId") long userId);
}
