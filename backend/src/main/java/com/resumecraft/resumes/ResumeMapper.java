package com.resumecraft.resumes;

import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** XML-backed owner-scoped persistence. Every mutation must affect exactly one live row. */
@Mapper
public interface ResumeMapper {
    List<ResumeRecord> list(@Param("owner") UUID owner);
    ResumeRecord find(@Param("id") UUID id, @Param("owner") UUID owner);
    String email(@Param("owner") UUID owner);
    boolean ownsPhoto(@Param("id") UUID id, @Param("owner") UUID owner);
    int insert(@Param("id") UUID id, @Param("owner") UUID owner, @Param("write") ResumeWrite write);
    int save(@Param("id") UUID id, @Param("owner") UUID owner, @Param("write") ResumeWrite write);
    int rename(@Param("id") UUID id, @Param("owner") UUID owner, @Param("title") String title);
    int delete(@Param("id") UUID id, @Param("owner") UUID owner);
    UUID duplicate(@Param("id") UUID id, @Param("owner") UUID owner);
}
