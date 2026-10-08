package com.resumecraft.common.persistence;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking DB adapter. XML의 소유자 및 활성 조건은 모든 변경에도 적용된다. */
@Mapper
public interface PhotoMapper {
    PhotoRow findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
    int insert(PhotoRow row);
}
