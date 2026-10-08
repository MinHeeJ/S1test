package com.resumecraft;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts blocking MVC and discovers resource-owned controllers and XML mappers across feature packages. */
@SpringBootApplication
@MapperScan(basePackages = "com.resumecraft", annotationClass = Mapper.class)
public class ResumeCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeCraftApplication.class, args);
    }
}
