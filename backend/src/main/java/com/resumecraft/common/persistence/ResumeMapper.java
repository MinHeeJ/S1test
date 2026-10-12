package com.resumecraft.common.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;

/** Blocking XML adapter; owner predicates are enforced on every resource access. */
@Mapper
public interface ResumeMapper {
    List<ResumeRow> listOwned(@Param("userId") Long userId);

    /** Pagination and count share identical ownership and literal-title predicates. */
    List<ResumeRow> listPage(@Param("userId") Long userId, @Param("filter") String filter,
            @Param("pageLimit") int pageLimit, @Param("pageOffset") long pageOffset);

    long countOwned(@Param("userId") Long userId, @Param("filter") String filter);

    ResumeRow findOwned(@Param("id") Long id, @Param("userId") Long userId);

    Long insert(@Param("userId") Long userId, @Param("title") String title,
            @Param("template") String template, @Param("style") JsonNode style,
            @Param("content") JsonNode content);

    /** Full content save deliberately excludes title and immutable lifecycle fields. */
    int updateOwned(@Param("id") Long id, @Param("userId") Long userId,
            @Param("template") String template, @Param("style") JsonNode style,
            @Param("content") JsonNode content);

    int renameOwned(@Param("id") Long id, @Param("userId") Long userId, @Param("title") String title);

    int deleteOwned(@Param("id") Long id, @Param("userId") Long userId);
}
