package com.resumecraft.resumes;

import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** PostgreSQL operations always constrain existing resumes by owner and soft-deletion state. */
@Mapper
public interface ResumeMapper {
    UUID owner(@Param("identity") String identity);
    String email(@Param("owner") UUID owner);
    List<Resume> list(@Param("owner") UUID owner);
    Resume find(@Param("id") UUID id, @Param("owner") UUID owner);
    int insert(@Param("id") UUID id, @Param("owner") UUID owner, @Param("write") ResumeWrite write);
    int save(@Param("id") UUID id, @Param("owner") UUID owner, @Param("write") ResumeWrite write);
    int rename(@Param("id") UUID id, @Param("owner") UUID owner, @Param("title") String title);
    int delete(@Param("id") UUID id, @Param("owner") UUID owner);
    boolean photoOwned(@Param("id") UUID id, @Param("owner") UUID owner);
    int ready();
}
