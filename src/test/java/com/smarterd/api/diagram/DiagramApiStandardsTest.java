package com.smarterd.api.diagram;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.api.diagram.dto.PersistYdocSnapshotRequest;
import com.smarterd.api.diagram.dto.WsTicketRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Validation;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class DiagramApiStandardsTest {

    private static final Path DIAGRAM_DTO_ROOT = Path.of("src/main/java/com/smarterd/api/diagram/dto");

    @Test
    void diagramControllersDeclareOpenApiTagsOperationsAndResponses() {
        final var controllerTypes = List.of(
            DiagramController.class,
            DiagramContentController.class,
            DiagramExportController.class,
            DiagramMutationController.class,
            WsTicketController.class
        );

        assertThat(controllerTypes).allSatisfy((controllerType) -> {
            assertThat(controllerType.isAnnotationPresent(Tag.class)).as(controllerType.getName()).isTrue();
            assertThat(
                List.of(controllerType.getDeclaredMethods()).stream().filter(this::isEndpointMethod).toList()
            ).allSatisfy((method) -> {
                assertThat(method.isAnnotationPresent(Operation.class)).as(method.getName()).isTrue();
                assertThat(
                    method.isAnnotationPresent(ApiResponse.class) || method.isAnnotationPresent(ApiResponses.class)
                )
                    .as(method.getName())
                    .isTrue();
            });
        });
    }

    @Test
    void diagramDtoRecordsAreDocumentedWithSchema() throws IOException {
        final var undocumentedRecords = diagramDtoJavaFiles()
            .filter(DiagramApiStandardsTest::isRecordSource)
            .filter(DiagramApiStandardsTest::isMissingSchemaAnnotation)
            .map(Path::toString)
            .toList();

        assertThat(undocumentedRecords)
            .as("diagram API DTO records should be documented for Swagger/OpenAPI")
            .isEmpty();
    }

    @Test
    void diagramRequestValidationUsesLocalizedMessageKeys() {
        final var validator = Validation.buildDefaultValidatorFactory().getValidator();
        final var messages = Stream.of(
            validator.validate(new PersistYdocSnapshotRequest("", null, false)),
            validator.validate(new WsTicketRequest(null))
        )
            .flatMap((violations) -> violations.stream())
            .map((violation) -> String.valueOf(violation.getConstraintDescriptor().getAttributes().get("message")))
            .toList();

        assertThat(messages).isNotEmpty();
        assertThat(messages).allSatisfy((message) -> assertThat(message).startsWith("{validation."));
    }

    private boolean isEndpointMethod(Method method) {
        return (
            method.isAnnotationPresent(DeleteMapping.class) ||
            method.isAnnotationPresent(GetMapping.class) ||
            method.isAnnotationPresent(PatchMapping.class) ||
            method.isAnnotationPresent(PostMapping.class) ||
            method.isAnnotationPresent(PutMapping.class)
        );
    }

    private static Stream<Path> diagramDtoJavaFiles() throws IOException {
        return Files.walk(DIAGRAM_DTO_ROOT).filter((path) -> path.toString().endsWith(".java"));
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
