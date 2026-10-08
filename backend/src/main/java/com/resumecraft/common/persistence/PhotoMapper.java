package com.resumecraft.common.persistence;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Photo storage deliberately provides no delete or orphan-cleanup operation. */
@Mapper
public interface PhotoMapper {
    PhotoRow findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
    int insert(PhotoRow row);
}
