package com.smarterd.config.ai;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarEntry;
import java.util.jar.JarOutputStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AiProviderConfigTest {

    @TempDir
    private Path tempDir;

    @Test
    @DisplayName("resolveSchemaPath - jar classpath 리소스도 읽을 수 있는 파일 경로로 복사한다")
    void resolveSchemaPath_whenResourceLoadedFromJar_returnsReadableFile() throws Exception {
        // given
        final var jarPath = tempDir.resolve("ai-resources.jar");
        createJarResource(jarPath, "ai/provider-output.schema.json", "{\"type\":\"object\"}");

        final var previousClassLoader = Thread.currentThread().getContextClassLoader();
        try (var classLoader = new URLClassLoader(new java.net.URL[] { jarPath.toUri().toURL() }, null)) {
            Thread.currentThread().setContextClassLoader(classLoader);

            // when
            final var schemaPath = invokeResolveSchemaPath();

            // then
            assertThat(schemaPath).isRegularFile();
            assertThat(schemaPath.getFileName().toString()).startsWith("smart-erd-provider-output-schema-");
            assertThat(Files.readString(schemaPath)).contains("\"type\":\"object\"");
        } finally {
            Thread.currentThread().setContextClassLoader(previousClassLoader);
        }
    }

    /**
     * schema 리소스 경로 해석 메서드를 호출한다.
     *
     * @return schema 파일 경로
     */
    private Path invokeResolveSchemaPath() throws Exception {
        final Method method = AiProviderConfig.class.getDeclaredMethod("resolveSchemaPath");
        method.setAccessible(true);
        return (Path) method.invoke(new AiProviderConfig());
    }

    /**
     * 테스트용 classpath JAR 리소스를 생성한다.
     *
     * @param jarPath JAR 파일 경로
     * @param entryName JAR 엔트리명
     * @param content 리소스 내용
     */
    private void createJarResource(Path jarPath, String entryName, String content) throws Exception {
        try (var outputStream = new JarOutputStream(Files.newOutputStream(jarPath))) {
            outputStream.putNextEntry(new JarEntry(entryName));
            outputStream.write(content.getBytes(UTF_8));
            outputStream.closeEntry();
        }
    }
}
