package com.smarterd.api.common;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;

class CommonApiContractTest {

    private static final Path COMMON_DTO_ROOT = Path.of("src/main/java/com/smarterd/api/common/dto");

    @Test
    void globalExceptionHandlerUsesErrorResponseDtoContract() {
        final var returnTypes = Stream.of(GlobalExceptionHandler.class.getDeclaredMethods())
            .filter((method) -> method.isAnnotationPresent(ExceptionHandler.class))
            .map(Method::getGenericReturnType)
            .map((type) -> type.getTypeName())
            .toList();

        assertThat(returnTypes).allSatisfy((returnType) ->
            assertThat(returnType)
                .contains(ResponseEntity.class.getName())
                .contains("com.smarterd.api.common.dto.ErrorResponse")
                .doesNotContain(Map.class.getName())
        );
    }

    @Test
    void commonDtoRecordsAreDocumentedWithSchema() throws IOException {
        final var undocumentedRecords = commonDtoJavaFiles()
            .filter(CommonApiContractTest::isRecordSource)
            .filter(CommonApiContractTest::isMissingSchemaAnnotation)
            .map(Path::toString)
            .toList();

        assertThat(undocumentedRecords).as("common API DTO records should be documented for Swagger/OpenAPI").isEmpty();
    }

    private static Stream<Path> commonDtoJavaFiles() throws IOException {
        return Files.walk(COMMON_DTO_ROOT).filter((path) -> path.toString().endsWith(".java"));
    }

    private static boolean isRecordSource(Path path) {
        try {
            return Files.readString(path).contains("public record ");
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read " + path, exception);
        }
    }

    private static boolean isMissingSchemaAnnotation(Path path) {
        try {
            return !Files.readString(path).contains("@" + Schema.class.getSimpleName() + "(description");
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read " + path, exception);
        }
    }
}
