package com.resumecraft.common.persistence;

import java.util.UUID;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Blocking DB adapter. XML의 소유자 및 활성 조건은 모든 변경에도 적용된다. */
@Mapper
public interface ResumeMapper {
    List<ResumeRow> findActiveByUserId(@Param("userId") UUID userId);
    /** 목록과 total은 동일 소유권 및 literal 검색 조건을 사용한다. */
    List<ResumeRow> listOwnedActive(
            @Param("userId") UUID userId,
            @Param("filter") String filter,
            @Param("pageLimit") int pageLimit,
            @Param("pageOffset") long pageOffset);
    long countOwnedActive(@Param("userId") UUID userId, @Param("filter") String filter);
    ResumeRow findOwnedActive(@Param("id") UUID id, @Param("userId") UUID userId);
    int insert(ResumeRow row);
    int updateOwnedActive(ResumeRow row);
    int renameOwnedActive(@Param("id") UUID id, @Param("userId") UUID userId, @Param("title") String title);
    int deleteOwnedActive(@Param("id") UUID id, @Param("userId") UUID userId);
}
