package com.smarterd.api.dictionary;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
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

class DictionaryApiStandardsTest {

    private static final Path DICTIONARY_API_ROOT = Path.of("src/main/java/com/smarterd/api/dictionary");
    private static final Path DICTIONARY_DTO_ROOT = DICTIONARY_API_ROOT.resolve("dto");
    private static final int MAX_CONTROLLER_LINES = 300;

    @Test
    void dictionaryControllersStayWithinFocusedSizeLimit() throws IOException {
        final var oversizedControllers = javaFiles(DICTIONARY_API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .filter(DictionaryApiStandardsTest::hasTooManyLines)
            .map(Path::toString)
            .toList();

        assertThat(oversizedControllers)
            .as("dictionary API controllers should stay below %s lines", MAX_CONTROLLER_LINES)
            .isEmpty();
    }

    @Test
    void dictionaryControllersDeclareOpenApiTagsOperationsAndResponses() throws IOException {
        final var undocumentedEndpoints = controllerTypes()
            .peek((controllerType) ->
                assertThat(controllerType.isAnnotationPresent(Tag.class)).as(controllerType.getName()).isTrue()
            )
            .flatMap((controllerType) -> Stream.of(controllerType.getDeclaredMethods()))
            .filter(DictionaryApiStandardsTest::isEndpointMethod)
            .filter(
                (method) ->
                    !method.isAnnotationPresent(Operation.class) ||
                    (!method.isAnnotationPresent(ApiResponse.class) && !method.isAnnotationPresent(ApiResponses.class))
            )
            .map((method) -> method.getDeclaringClass().getSimpleName() + "." + method.getName())
            .toList();

        assertThat(undocumentedEndpoints)
            .as("dictionary API endpoints should document Operation and ApiResponse for Swagger/OpenAPI")
            .isEmpty();
    }

    @Test
    void dictionaryDtoRecordsAreDocumentedWithSchema() throws IOException {
        final var undocumentedRecords = javaFiles(DICTIONARY_DTO_ROOT)
            .filter(DictionaryApiStandardsTest::isRecordSource)
            .filter(DictionaryApiStandardsTest::isMissingSchemaAnnotation)
            .map(Path::toString)
            .toList();

        assertThat(undocumentedRecords)
            .as("dictionary API DTO records should be documented for Swagger/OpenAPI")
            .isEmpty();
    }

    @Test
    void dictionaryRequestValidationUsesLocalizedMessageKeys() {
        final var validator = Validation.buildDefaultValidatorFactory().getValidator();
        final var messages = Stream.of(
            validationMessages(
                validator,
                new com.smarterd.api.dictionary.dto.BulkDomainRow(null, null, "", "", null, null, null)
            ),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkTermRow("", "", null, null)),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkWordRow("", "", null)),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkDomainSaveRequest("", null)),
            validationMessages(
                validator,
                new com.smarterd.api.dictionary.dto.BulkDomainSaveRequest("token", List.of(0))
            ),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkTermSaveRequest("", null)),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkTermSaveRequest("token", List.of(0))),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkWordSaveRequest("", null)),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.BulkWordSaveRequest("token", List.of(0))),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.SuggestRequest("")),
            validationMessages(validator, new com.smarterd.api.dictionary.dto.SuggestRequest("a"))
        )
            .flatMap((stream) -> stream)
            .toList();

        assertThat(messages).isNotEmpty();
        assertThat(messages).allSatisfy((message) -> assertThat(message).startsWith("{validation."));
    }

    private static Stream<Class<?>> controllerTypes() throws IOException {
        return javaFiles(DICTIONARY_API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .map(DictionaryApiStandardsTest::toControllerType);
    }

    private static Class<?> toControllerType(Path path) {
        final var className = path.getFileName().toString().replace(".java", "");

        try {
            return Class.forName("com.smarterd.api.dictionary." + className);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Failed to load controller class " + className, exception);
        }
    }

    private static Stream<String> validationMessages(Validator validator, Object target) {
        return validator
            .validate(target)
            .stream()
            .map((violation) -> String.valueOf(violation.getConstraintDescriptor().getAttributes().get("message")));
    }

    private static boolean isEndpointMethod(Method method) {
        return (
            method.isAnnotationPresent(DeleteMapping.class) ||
            method.isAnnotationPresent(GetMapping.class) ||
            method.isAnnotationPresent(PatchMapping.class) ||
            method.isAnnotationPresent(PostMapping.class) ||
            method.isAnnotationPresent(PutMapping.class)
        );
    }

    private static Stream<Path> javaFiles(Path root) throws IOException {
        return Files.walk(root).filter((path) -> path.toString().endsWith(".java"));
    }

    private static boolean hasTooManyLines(Path path) {
        try {
            return Files.lines(path).count() > MAX_CONTROLLER_LINES;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to count lines for " + path, exception);
        }
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
