package com.resumecraft.photos;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Native PostgreSQL photo access with ownership enforced in the read predicate. */
@Mapper
public interface PhotoMapper {
    int insert(Photo photo);

    Photo findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
}
