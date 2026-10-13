package com.resumecraft.common;

import org.apache.ibatis.annotations.Mapper;

/** Executes an actual database read for readiness without mutating business rows. */
@Mapper
public interface DatabaseHealthMapper {
    int ping();
}
