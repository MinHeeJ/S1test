package com.resumecraft;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts the synchronous MVC application and its blocking MyBatis adapters. */
@SpringBootApplication
public class ResumeCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeCraftApplication.class, args);
    }
}
