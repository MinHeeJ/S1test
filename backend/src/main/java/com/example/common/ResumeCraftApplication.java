package com.example.common;

import org.mybatis.spring.annotation.MapperScan;
import org.apache.ibatis.annotations.Mapper;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts the blocking MVC application and discovers resource-owned components and XML mappers. */
@SpringBootApplication(
    scanBasePackages = {"com.example", "auth", "resume", "photo", "persistence", "config", "validation"},
    exclude = org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class
)
@MapperScan(
    basePackages = {"com.example", "auth", "resume", "photo", "persistence"},
    annotationClass = Mapper.class
)
public class ResumeCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeCraftApplication.class, args);
    }
}
