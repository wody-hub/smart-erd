package com.smarterd.application.ai.prompt;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

/**
 * Loads versioned AI prompt templates from classpath resources.
 */
@Component
public class PromptTemplateLoader {

    private final ResourceLoader resourceLoader;

    public PromptTemplateLoader(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public String load(String promptVersion) {
        final var resource = resourceLoader.getResource("classpath:ai/prompts/" + promptVersion + ".md");
        try (var inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }
}
