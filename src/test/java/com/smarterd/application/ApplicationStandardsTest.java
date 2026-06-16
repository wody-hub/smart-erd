package com.smarterd.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

class ApplicationStandardsTest {

    private static final Path APPLICATION_ROOT = Path.of("src/main/java/com/smarterd/application");
    private static final int MAX_APPLICATION_CLASS_LINES = 300;
    private static final Pattern DIRECT_STRING_NORMALIZATION = Pattern.compile(
        "\\.isBlank\\(\\)|toLowerCase\\((?:java\\.util\\.)?Locale\\.ROOT\\)|toUpperCase\\((?:java\\.util\\.)?Locale\\.ROOT\\)"
    );

    @Test
    void applicationCodeUsesAppStringUtilsForStringNormalization() throws IOException {
        final var violations = Files.walk(APPLICATION_ROOT)
            .filter((path) -> path.toString().endsWith(".java"))
            .flatMap((path) -> directStringNormalizationViolations(path).stream())
            .toList();

        assertThat(violations).isEmpty();
    }

    @Test
    void aiServicesUseReadOnlyDefaultAndExplicitWriteTransactions() throws NoSuchMethodException {
        assertClassReadOnly(com.smarterd.application.ai.proposal.AiActionProposalService.class);
        assertClassReadOnly(com.smarterd.application.ai.history.AiProjectHistoryService.class);
        assertClassReadOnly(com.smarterd.application.ai.AiExecutionAuditService.class);
        assertWriteTransaction(
            com.smarterd.application.ai
                .AiExecutionAuditService.class.getMethod(
                "record",
                com.smarterd.application.ai.AiExecutionRegistry.ExecutionSnapshot.class
            )
        );
        assertWriteTransaction(
            com.smarterd.application.ai
                .AiExecutionAuditService.class.getMethod(
                "recordProposalCreated",
                com.smarterd.domain.ai.AiActionProposal.class
            )
        );
        assertWriteTransaction(
            com.smarterd.application.ai
                .AiExecutionAuditService.class.getMethod(
                "recordProposalDecision",
                com.smarterd.domain.ai.AiActionProposal.class
            )
        );
    }

    @Test
    void applicationClassesStayBelowGodClassThreshold() throws IOException {
        final var violations = Files.walk(APPLICATION_ROOT)
            .filter((path) -> path.toString().endsWith(".java"))
            .filter((path) -> lineCount(path) > MAX_APPLICATION_CLASS_LINES)
            .map((path) -> path + " has " + lineCount(path) + " lines")
            .toList();

        assertThat(violations).isEmpty();
    }

    private static java.util.List<String> directStringNormalizationViolations(Path path) {
        try {
            final var lines = Files.readAllLines(path);
            final var violations = new java.util.ArrayList<String>();
            for (var index = 0; index < lines.size(); index++) {
                final var line = lines.get(index);
                if (DIRECT_STRING_NORMALIZATION.matcher(line).find()) {
                    violations.add(path + ":" + (index + 1) + " " + line.trim());
                }
            }
            return violations;
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static void assertClassReadOnly(Class<?> serviceType) {
        final var transactional = serviceType.getAnnotation(Transactional.class);
        assertThat(transactional)
            .as(serviceType.getSimpleName() + " should declare read-only transaction default")
            .isNotNull();
        assertThat(transactional.readOnly())
            .as(serviceType.getSimpleName() + " should default to read-only transactions")
            .isTrue();
    }

    private static void assertWriteTransaction(java.lang.reflect.Method method) {
        final var transactional = method.getAnnotation(Transactional.class);
        assertThat(transactional)
            .as(
                method.getDeclaringClass().getSimpleName() +
                    "." +
                    method.getName() +
                    " should override write transaction"
            )
            .isNotNull();
        assertThat(transactional.readOnly())
            .as(method.getDeclaringClass().getSimpleName() + "." + method.getName() + " should be writable")
            .isFalse();
    }

    private static long lineCount(Path path) {
        try {
            return Files.lines(path).count();
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
