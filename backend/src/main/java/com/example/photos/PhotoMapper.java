package com.example.photos;

import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** XML-backed bytea persistence with ownership applied before materialization. */
@Mapper
public interface PhotoMapper {
    /** Inserts a newly issued UUID without reading through a resume-dependent query. */
    int insert(Photo photo);

    /** Photos remain readable by their owner after resume unlinking or logical deletion. */
    Photo findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
}
