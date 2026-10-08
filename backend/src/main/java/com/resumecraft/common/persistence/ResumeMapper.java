package com.resumecraft.common.persistence;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** All existing-resume reads and mutations require owner plus active state. */
@Mapper
public interface ResumeMapper {
    ResumeRow findOwned(@Param("id") UUID id, @Param("userId") UUID userId);
    List<ResumeRow> listOwned(@Param("userId") UUID userId, @Param("offset") int offset,
        @Param("limit") int limit);
    /** Literal title substring filtering is applied before pagination. */
    List<ResumeRow> listFilteredOwned(@Param("userId") UUID userId, @Param("offset") int offset,
        @Param("limit") int limit, @Param("filter") String filter);
    long countOwned(@Param("userId") UUID userId);
    int insert(ResumeRow row);
    int updateOwned(@Param("id") UUID id, @Param("userId") UUID userId, @Param("title") String title,
        @Param("template") String template, @Param("style") JsonNode style, @Param("content") JsonNode content,
        @Param("updatedAt") OffsetDateTime updatedAt);
    int renameOwned(@Param("id") UUID id, @Param("userId") UUID userId, @Param("title") String title,
        @Param("updatedAt") OffsetDateTime updatedAt);
    int deleteOwned(@Param("id") UUID id, @Param("userId") UUID userId,
        @Param("updatedAt") OffsetDateTime updatedAt);
}
