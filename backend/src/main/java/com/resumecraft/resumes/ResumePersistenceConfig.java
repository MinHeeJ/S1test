package com.resumecraft.resumes;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** Registers only this feature's XML-backed mapper without changing shared mapper registration. */
@Configuration
@MapperScan("com.resumecraft.resumes")
public class ResumePersistenceConfig {
}
