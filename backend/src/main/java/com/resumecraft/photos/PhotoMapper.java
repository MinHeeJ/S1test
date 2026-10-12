package com.resumecraft.photos;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Stores original bytes and reads only the current owner's photo. */
@Mapper
public interface PhotoMapper {
    int insert(PhotoRecord photo);

    PhotoRecord findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
}
