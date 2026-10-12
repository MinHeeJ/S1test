package com.resumecraft.auth;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** Registers only authentication mappers outside the common bootstrap package. */
@Configuration
@MapperScan(basePackageClasses = AuthMapper.class)
public class AuthPersistenceConfiguration {
}
