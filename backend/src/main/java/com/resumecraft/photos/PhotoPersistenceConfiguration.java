package com.resumecraft.photos;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

/** Registers the photo mapper outside the common bootstrap package. */
@Configuration
@MapperScan(basePackageClasses = PhotoMapper.class)
public class PhotoPersistenceConfiguration {
}
