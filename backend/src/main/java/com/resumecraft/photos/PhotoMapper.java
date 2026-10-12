package com.resumecraft.photos;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** XML-backed bytea persistence; reads always include the authenticated owner. */
@Mapper
public interface PhotoMapper {
    UUID selectUserId(@Param("identity") String identity);

    int insert(Photo photo);

    Photo findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
}
