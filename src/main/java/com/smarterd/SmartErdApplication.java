package com.smarterd;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class SmartErdApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmartErdApplication.class, args);
    }
}
