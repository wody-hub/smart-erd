package com.smarterd.config.ai;

import com.smarterd.application.ai.AiExecutionRegistry;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.NoopAiProvider;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI provider gateway bean configuration.
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiProviderConfig {

    @Bean
    Clock aiClock() {
        return Clock.systemUTC();
    }

    @Bean
    AiExecutionRegistry aiExecutionRegistry(AiProperties properties, Clock aiClock) {
        return new AiExecutionRegistry(properties.getExecution().getRetention(), aiClock);
    }

    @Bean
    AiProvider aiProvider(AiProperties properties, Clock aiClock) {
        return new NoopAiProvider(aiClock);
    }
}
