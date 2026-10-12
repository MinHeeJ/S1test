package com.resumecraft;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/** Starts the servlet application and discovers all ResumeCraft feature packages. */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class ResumeCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(ResumeCraftApplication.class, args);
    }
}
