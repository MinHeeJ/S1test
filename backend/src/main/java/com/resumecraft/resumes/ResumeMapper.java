package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking owner-scoped persistence port backed by the resume XML mapper. */
@Mapper
public interface ResumeMapper {
    List<ResumeDocument> list(@Param("owner") UUID owner, @Param("filter") String filter,
            @Param("limit") int limit, @Param("pageOffset") long pageOffset);
    ResumeDocument find(@Param("id") UUID id, @Param("owner") UUID owner);
    ResumeDocument lock(@Param("id") UUID id, @Param("owner") UUID owner);
    int insert(@Param("id") UUID id, @Param("owner") UUID owner, @Param("title") String title,
            @Param("template") String template, @Param("style") JsonNode style, @Param("content") JsonNode content);
    int update(@Param("id") UUID id, @Param("owner") UUID owner, @Param("title") String title,
            @Param("template") String template, @Param("style") JsonNode style, @Param("content") JsonNode content);
    int rename(@Param("id") UUID id, @Param("owner") UUID owner, @Param("title") String title);
    int delete(@Param("id") UUID id, @Param("owner") UUID owner);
    boolean ownsPhoto(@Param("id") UUID id, @Param("owner") UUID owner);
}
