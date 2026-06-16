package com.smarterd.api;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class ApiStandardsTest {

    private static final Path API_ROOT = Path.of("src/main/java/com/smarterd/api");
    private static final int MAX_CONTROLLER_LINES = 300;
    private static final Set<String> VALIDATION_ANNOTATIONS = Set.of(
        "AssertFalse",
        "AssertTrue",
        "DecimalMax",
        "DecimalMin",
        "Max",
        "Min",
        "NotBlank",
        "NotEmpty",
        "NotNull",
        "Pattern",
        "Positive",
        "PositiveOrZero",
        "Size"
    );

    @Test
    void apiControllersStayWithinFocusedSizeLimit() throws IOException {
        final var oversizedControllers = javaFiles(API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .filter(ApiStandardsTest::hasTooManyLines)
            .map(Path::toString)
            .toList();

        assertThat(oversizedControllers)
            .as("API controllers should stay below %s lines", MAX_CONTROLLER_LINES)
            .isEmpty();
    }

    @Test
    void apiControllersDeclareOpenApiTagsOperationsAndResponses() throws IOException {
        final var undocumentedEndpoints = controllerTypes()
            .peek((controllerType) ->
                assertThat(controllerType.isAnnotationPresent(Tag.class)).as(controllerType.getName()).isTrue()
            )
            .flatMap((controllerType) -> Stream.of(controllerType.getDeclaredMethods()))
            .filter(ApiStandardsTest::isEndpointMethod)
            .filter(
                (method) ->
                    !method.isAnnotationPresent(Operation.class) ||
                    (!method.isAnnotationPresent(ApiResponse.class) && !method.isAnnotationPresent(ApiResponses.class))
            )
            .map((method) -> method.getDeclaringClass().getSimpleName() + "." + method.getName())
            .toList();

        assertThat(undocumentedEndpoints)
            .as("API endpoints should document Operation and ApiResponse for Swagger/OpenAPI")
            .isEmpty();
    }

    @Test
    void apiDtoRecordsAreDocumentedWithSchema() throws IOException {
        final var undocumentedRecords = javaFiles(API_ROOT)
            .filter((path) -> path.toString().contains("/dto/"))
            .filter(ApiStandardsTest::isRecordSource)
            .filter(ApiStandardsTest::isMissingSchemaAnnotation)
            .map(Path::toString)
            .toList();

        assertThat(undocumentedRecords).as("API DTO records should be documented for Swagger/OpenAPI").isEmpty();
    }

    @Test
    void apiRequestValidationAnnotationsUseLocalizedMessageKeys() throws IOException {
        final var violations = javaFiles(API_ROOT)
            .flatMap(ApiStandardsTest::validationAnnotationsMissingMessage)
            .toList();

        assertThat(violations)
            .as("API Bean Validation annotations should use explicit {validation.*} message keys")
            .isEmpty();
    }

    private static Stream<Class<?>> controllerTypes() throws IOException {
        return javaFiles(API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .map(ApiStandardsTest::toControllerType);
    }

    private static Class<?> toControllerType(Path path) {
        final var relative = API_ROOT.relativize(path).toString();
        final var className = relative.replace(".java", "").replace('/', '.').replace('\\', '.');

        try {
            return Class.forName("com.smarterd.api." + className);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("Failed to load controller class " + className, exception);
        }
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

    private static Stream<String> validationAnnotationsMissingMessage(Path path) {
        try {
            final var source = Files.readString(path);
            final var violations = new java.util.ArrayList<String>();
            var index = 0;

            while (index < source.length()) {
                final var annotationStart = source.indexOf('@', index);
                if (annotationStart < 0) {
                    break;
                }
                final var annotation = readAnnotation(source, annotationStart);
                if (annotation == null) {
                    index = annotationStart + 1;
                    continue;
                }
                if (
                    VALIDATION_ANNOTATIONS.contains(annotation.name()) &&
                    !annotation.text().contains("message") &&
                    !isCommentLine(source, annotationStart)
                ) {
                    violations.add(path + ":" + lineNumber(source, annotationStart) + " " + annotation.text());
                }
                index = annotation.endIndex();
            }

            return violations.stream();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read " + path, exception);
        }
    }

    private static SourceAnnotation readAnnotation(String source, int startIndex) {
        var cursor = startIndex + 1;
        while (cursor < source.length() && Character.isJavaIdentifierPart(source.charAt(cursor))) {
            cursor++;
        }

        final var name = source.substring(startIndex + 1, cursor);
        while (cursor < source.length() && Character.isWhitespace(source.charAt(cursor))) {
            cursor++;
        }

        if (cursor >= source.length() || source.charAt(cursor) != '(') {
            return new SourceAnnotation(name, "@" + name, cursor);
        }

        final var endIndex = findClosingParenthesis(source, cursor);
        final var annotationEnd = endIndex < 0 ? cursor : endIndex + 1;
        return new SourceAnnotation(
            name,
            source.substring(startIndex, annotationEnd).replaceAll("\\s+", " "),
            annotationEnd
        );
    }

    private static int findClosingParenthesis(String source, int openIndex) {
        var depth = 0;
        for (var cursor = openIndex; cursor < source.length(); cursor++) {
            final var character = source.charAt(cursor);
            if (character == '(') {
                depth++;
            } else if (character == ')') {
                depth--;
                if (depth == 0) {
                    return cursor;
                }
            }
        }
        return -1;
    }

    private static boolean isCommentLine(String source, int index) {
        final var lineStart = source.lastIndexOf('\n', index) + 1;
        final var lineEnd = source.indexOf('\n', index);
        final var line = source.substring(lineStart, lineEnd < 0 ? source.length() : lineEnd).trim();
        return line.startsWith("*") || line.startsWith("//");
    }

    private static int lineNumber(String source, int index) {
        return source.substring(0, index).split("\\R", -1).length;
    }

    private record SourceAnnotation(String name, String text, int endIndex) {}
}
