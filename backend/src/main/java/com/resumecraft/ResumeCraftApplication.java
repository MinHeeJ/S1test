package com.resumecraft;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts the synchronous application and discovers all product feature packages. */
@SpringBootApplication(scanBasePackages = "com.resumecraft")
public class ResumeCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeCraftApplication.class, args);
    }
}
