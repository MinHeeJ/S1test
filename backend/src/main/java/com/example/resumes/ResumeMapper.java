package com.example.resumes;

import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** SQL adapter for owner-scoped active snapshots; list and count share one predicate. */
@Mapper
public interface ResumeMapper {
    UUID userId(@Param("identity") String identity);
    String email(@Param("owner") UUID owner);
    List<Resume> list(@Param("owner") UUID owner, @Param("filter") String filter,
        @Param("limit") int limit, @Param("pageOffset") long pageOffset);
    long count(@Param("owner") UUID owner, @Param("filter") String filter);
    Resume find(@Param("id") UUID id, @Param("owner") UUID owner);
    Resume lock(@Param("id") UUID id, @Param("owner") UUID owner);
    int photoExists(@Param("id") UUID id, @Param("owner") UUID owner);
    int insert(Resume resume);
    int update(Resume resume);
    int rename(Resume resume);
    int delete(Resume resume);
}
