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
import com.smarterd.utils.AppStringUtils;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
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

    private static final String PROVIDER_OUTPUT_SCHEMA_RESOURCE = "ai/provider-output.schema.json";
    private static final String CODEX_PROVIDER_PROMPT_RESOURCE = "ai/prompts/codex-provider-v1.md";

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
        return (
            AppStringUtils.equalsIgnoreCase("local-codex", provider) ||
            AppStringUtils.equalsIgnoreCase("codex", provider)
        );
    }

    private Path resolveSchemaPath() {
        return copyClasspathResourceToTempFile(
            PROVIDER_OUTPUT_SCHEMA_RESOURCE,
            "smart-erd-provider-output-schema-",
            ".json"
        );
    }

    /**
     * classpath 리소스를 프로세스 인자가 참조할 수 있는 임시 파일로 복사한다.
     *
     * @param resourcePath classpath 리소스 경로
     * @param prefix 임시 파일명 접두사
     * @param suffix 임시 파일명 접미사
     * @return 복사된 임시 파일 경로 또는 실패 시 {@code null}
     */
    private Path copyClasspathResourceToTempFile(String resourcePath, String prefix, String suffix) {
        final var resource = new ClassPathResource(resourcePath);
        try {
            final var schemaPath = Files.createTempFile(prefix, suffix);
            try (var inputStream = resource.getInputStream()) {
                Files.copy(inputStream, schemaPath, StandardCopyOption.REPLACE_EXISTING);
            }
            schemaPath.toFile().deleteOnExit();
            return schemaPath;
        } catch (IOException ex) {
            return null;
        }
    }

    private String loadPromptTemplate() {
        final var resource = new ClassPathResource(CODEX_PROVIDER_PROMPT_RESOURCE);
        try (var inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            return null;
        }
    }
}
