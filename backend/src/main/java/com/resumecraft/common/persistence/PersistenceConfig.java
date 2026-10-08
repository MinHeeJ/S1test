package com.resumecraft.common.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** Finds only annotated blocking MyBatis adapters throughout the product feature packages. */
@Configuration
@MapperScan(basePackages = "com.resumecraft", annotationClass = Mapper.class)
public class PersistenceConfig {
}
