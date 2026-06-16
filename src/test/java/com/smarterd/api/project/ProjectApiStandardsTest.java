package com.smarterd.api.project;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

class ProjectApiStandardsTest {

    private static final Path PROJECT_API_ROOT = Path.of("src/main/java/com/smarterd/api/project");
    private static final int MAX_CONTROLLER_LINES = 300;
    private static final Pattern DTO_PATTERN_LINE = Pattern.compile(
        "\\s*dtoPattern:\\s+['\"]?(?<pattern>.+?)['\"]?\\s*"
    );
    private static final List<String> COMMAND_STYLE_PATH_FRAGMENTS = List.of(
        "/advance",
        "/bulk-create",
        "/dependency-shift-apply",
        "/dependency-shift-preview",
        "/download/excel",
        "/duplicate-subtree",
        "/instantiate",
        "/reorder"
    );
    private static final List<Class<?>> SPLIT_WBS_CONTROLLER_TYPES = List.of(
        WbsDependencyController.class,
        WbsDocumentController.class,
        WbsHistoryController.class,
        WbsPlanningController.class
    );

    @Test
    void projectApiControllers_stayWithinFocusedSizeLimit() throws IOException {
        final var oversizedControllers = javaFiles(PROJECT_API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .filter(ProjectApiStandardsTest::hasTooManyLines)
            .map(Path::toString)
            .toList();

        assertThat(oversizedControllers)
            .as("project API controllers should stay below %s lines", MAX_CONTROLLER_LINES)
            .isEmpty();
    }

    @Test
    void siConfigDtoPattern_coversNestedProjectDtoPackages() throws IOException {
        final var dtoPattern = Files.readAllLines(Path.of("si-config.yml"))
            .stream()
            .map(DTO_PATTERN_LINE::matcher)
            .filter(java.util.regex.Matcher::matches)
            .map((matcher) -> matcher.group("pattern"))
            .findFirst()
            .orElseThrow();
        final var matcher = FileSystems.getDefault().getPathMatcher("glob:" + dtoPattern);
        final var uncoveredDtoFiles = javaFiles(PROJECT_API_ROOT.resolve("dto"))
            .filter((path) -> !matcher.matches(path))
            .map(Path::toString)
            .toList();

        assertThat(uncoveredDtoFiles)
            .as("si-config.yml backend.structure.dtoPattern should include nested project DTO packages")
            .isEmpty();
    }

    @Test
    void projectIssueController_usesQueryObjectForSharedFilters() {
        final var methods = List.of(findMethod("getProjectIssues"), findMethod("downloadProjectIssuesExcel"));

        assertThat(methods).allSatisfy((method) ->
            assertThat(method.getParameterCount())
                .as("%s should bind repeated issue filters through one query object", method.getName())
                .isLessThanOrEqualTo(5)
        );
    }

    @Test
    void projectApiMappings_useResourceOrientedPaths() throws IOException {
        final var commandStyleMappings = javaFiles(PROJECT_API_ROOT)
            .filter((path) -> path.getFileName().toString().endsWith("Controller.java"))
            .flatMap(ProjectApiStandardsTest::matchingCommandStylePathFragments)
            .toList();

        assertThat(commandStyleMappings)
            .as("project API controller mappings should use resource-oriented path nouns")
            .isEmpty();
    }

    @Test
    void projectDtoRecords_areDocumentedWithSchema() throws IOException {
        final var undocumentedRecords = javaFiles(PROJECT_API_ROOT.resolve("dto"))
            .filter(ProjectApiStandardsTest::isRecordSource)
            .filter(ProjectApiStandardsTest::isMissingSchemaAnnotation)
            .map(Path::toString)
            .toList();

        assertThat(undocumentedRecords)
            .as("project API DTO records should be documented for Swagger/OpenAPI")
            .isEmpty();
    }

    @Test
    void splitWbsControllerEndpoints_areDocumentedWithApiResponses() {
        final var undocumentedEndpoints = SPLIT_WBS_CONTROLLER_TYPES.stream()
            .flatMap((controllerType) ->
                Stream.of(controllerType.getDeclaredMethods()).filter(ProjectApiStandardsTest::isEndpointMethod)
            )
            .filter(
                (method) ->
                    !method.isAnnotationPresent(ApiResponse.class) && !method.isAnnotationPresent(ApiResponses.class)
            )
            .map((method) -> method.getDeclaringClass().getSimpleName() + "." + method.getName())
            .toList();

        assertThat(undocumentedEndpoints)
            .as("split WBS controller endpoints should document HTTP responses for Swagger/OpenAPI")
            .isEmpty();
    }

    private static Method findMethod(String name) {
        return Stream.of(ProjectIssueController.class.getDeclaredMethods())
            .filter((method) -> method.getName().equals(name))
            .findFirst()
            .orElseThrow();
    }

    private static boolean isEndpointMethod(Method method) {
        return (
            method.isAnnotationPresent(GetMapping.class) ||
            method.isAnnotationPresent(PostMapping.class) ||
            method.isAnnotationPresent(PutMapping.class) ||
            method.isAnnotationPresent(PatchMapping.class) ||
            method.isAnnotationPresent(DeleteMapping.class)
        );
    }

    private static Stream<Path> javaFiles(Path root) throws IOException {
        return Files.walk(root).filter((path) -> path.toString().endsWith(".java"));
    }

    private static Stream<String> matchingCommandStylePathFragments(Path path) {
        try {
            final var source = Files.readString(path);
            return COMMAND_STYLE_PATH_FRAGMENTS.stream()
                .filter(source::contains)
                .map((fragment) -> path + " contains " + fragment);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read " + path, exception);
        }
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
