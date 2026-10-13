package com.resumecraft.resumes;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking adapter; every resource predicate includes the authenticated owner and live state. */
@Mapper
public interface ResumeMapper {
    ResumeAccount account(@Param("identity") String identity);
    List<ResumeRow> list(@Param("userId") Long userId);
    ResumeRow find(@Param("id") Long id, @Param("userId") Long userId);
    Long insert(
            @Param("userId") Long userId, @Param("title") String title, @Param("template") String template,
            @Param("style") String style, @Param("content") String content
    );
    int save(
            @Param("id") Long id, @Param("userId") Long userId, @Param("title") String title,
            @Param("template") String template, @Param("style") String style, @Param("content") String content
    );
    int rename(@Param("id") Long id, @Param("userId") Long userId, @Param("title") String title);
    int delete(@Param("id") Long id, @Param("userId") Long userId);
    boolean ownsPhoto(@Param("photoId") String photoId, @Param("userId") Long userId);
}
