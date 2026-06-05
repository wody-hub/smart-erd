package com.smarterd.config.ai;

import com.smarterd.application.ai.AiExecutionRegistry;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.provider.CodexAvailabilityProbe;
import com.smarterd.application.ai.provider.CodexProcessRunner;
import com.smarterd.application.ai.provider.JavaProcessLauncher;
import com.smarterd.application.ai.provider.LocalCodexProcessProvider;
import com.smarterd.application.ai.provider.NoopAiProvider;
import com.smarterd.application.ai.provider.ProcessLauncher;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

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
    ProcessLauncher aiProcessLauncher() {
        return new JavaProcessLauncher();
    }

    @Bean
    CodexProcessRunner codexProcessRunner(ProcessLauncher aiProcessLauncher) {
        return new CodexProcessRunner(aiProcessLauncher);
    }

    @Bean
    AiProvider aiProvider(
        AiProperties properties,
        Clock aiClock,
        ProcessLauncher aiProcessLauncher,
        CodexProcessRunner codexProcessRunner,
        ProviderOutputValidator outputValidator
    ) {
        if (isLocalCodexProvider(properties.getProvider())) {
            final var executable = properties.getCodex().getExecutable();
            final var probe = new CodexAvailabilityProbe(executable, aiProcessLauncher, aiClock);
            return new LocalCodexProcessProvider(
                codexProcessRunner,
                outputValidator,
                probe::status,
                executable,
                properties.getExecution().getTimeout(),
                resolveSchemaPath(),
                loadPromptTemplate()
            );
        }
        return new NoopAiProvider(aiClock);
    }

    private boolean isLocalCodexProvider(String provider) {
        return "local-codex".equalsIgnoreCase(provider) || "codex".equalsIgnoreCase(provider);
    }

    private Path resolveSchemaPath() {
        try {
            return new ClassPathResource("ai/provider-output.schema.json").getFile().toPath();
        } catch (Exception ex) {
            return null;
        }
    }

    private String loadPromptTemplate() {
        final var resource = new ClassPathResource("ai/prompts/codex-provider-v1.md");
        try (var inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return null;
        }
    }
}
