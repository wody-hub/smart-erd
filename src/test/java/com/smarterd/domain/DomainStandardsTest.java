package com.smarterd.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DomainStandardsTest {

    private static final Path DOMAIN_SOURCE_ROOT = Path.of("src/main/java/com/smarterd/domain");
    private static final int MAX_DOMAIN_SOURCE_LINES = 300;
    private static final Set<Path> FIRST_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/project/service/ProjectService.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/WordService.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramIndexDefinitionExportService.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainStartupBackfillService.java")
    );
    private static final Set<Path> SECOND_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/AbstractBulkService.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkExcelReportSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkFileParsingSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkLogicalNameLookupSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkMessageResolver.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkTemplateCellStyleFactory.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkTemplateDataSheetStyler.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkTemplateExcelSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkTemplateGuideSheetWriter.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkTemplateType.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkValidationPreviewSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/BulkValidationSessionManager.java")
    );
    private static final Set<Path> THIRD_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkErrorReportRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkExistingNameSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkRowParser.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkSaveSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkService.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkTemplateRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkValidationResultAppender.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkValidationResult.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkValidationSession.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/DomainBulkValidationSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/NormalizedDomainRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/ValidatedDomainRow.java")
    );
    private static final Set<Path> FOURTH_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramRealtimeSnapshotStateSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotCacheSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotCompactionSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotEncodingSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotFlushSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotLifecycleSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotPersistenceSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotService.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/service/DiagramSnapshotShutdownFlushResult.java")
    );
    private static final Set<Path> FIFTH_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsParentRef.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningBulkCreateSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningInstantiationSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningItemFactory.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningPayloadJsonSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningResultMapper.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningService.java"),
        Path.of("src/main/java/com/smarterd/domain/pm/wbs/service/WbsPlanningSnapshotSupport.java")
    );
    private static final Set<Path> SIXTH_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkErrorReportRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkSaveSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkService.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkTemplateRow.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkValidationResult.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkValidationSession.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/TermBulkValidationSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/dictionary/service/ValidatedTermRow.java")
    );
    private static final Set<Path> SEVENTH_PASS_GOD_CLASS_REFACTOR_TARGETS = Set.of(
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomBroadcastSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomDiscardSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomJoinSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomLeaveSupport.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomManager.java"),
        Path.of("src/main/java/com/smarterd/domain/diagram/websocket/room/DiagramRoomUpdateSupport.java")
    );

    @Test
    void domainCodeUsesAppStringUtilsForStringNormalization() throws IOException {
        final var violations = new ArrayList<String>();

        for (final var sourceFile : domainSourceFiles()) {
            final var lines = Files.readAllLines(sourceFile);
            for (var index = 0; index < lines.size(); index++) {
                collectStringNormalizationViolation(violations, sourceFile, index + 1, lines.get(index));
            }
        }

        assertThat(violations).isEmpty();
    }

    @Test
    void firstPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(FIRST_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void secondPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(SECOND_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void thirdPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(THIRD_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void fourthPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(FOURTH_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void fifthPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(FIFTH_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void sixthPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(SIXTH_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    @Test
    void seventhPassDomainGodClassTargetsStayBelowThreshold() throws IOException {
        assertSourceFilesStayBelowThreshold(SEVENTH_PASS_GOD_CLASS_REFACTOR_TARGETS);
    }

    private void assertSourceFilesStayBelowThreshold(Set<Path> sourceFiles) throws IOException {
        final var violations = new ArrayList<String>();

        for (final var sourceFile : sourceFiles) {
            final var lineCount = Files.readAllLines(sourceFile).size();
            if (lineCount > MAX_DOMAIN_SOURCE_LINES) {
                violations.add(sourceFile + " has " + lineCount + " lines");
            }
        }

        assertThat(violations).isEmpty();
    }

    /**
     * 도메인 소스 파일 목록을 반환한다.
     *
     * @return 도메인 Java 소스 파일 목록
     */
    private List<Path> domainSourceFiles() throws IOException {
        try (var stream = Files.walk(DOMAIN_SOURCE_ROOT)) {
            return stream
                .filter(Files::isRegularFile)
                .filter((path) -> path.toString().endsWith(".java"))
                .sorted()
                .toList();
        }
    }

    /**
     * 문자열 정규화 규칙 위반을 수집한다.
     *
     * @param violations 위반 목록
     * @param sourceFile 검사 대상 파일
     * @param lineNumber 라인 번호
     * @param line 검사 대상 라인
     */
    private void collectStringNormalizationViolation(
        List<String> violations,
        Path sourceFile,
        int lineNumber,
        String line
    ) {
        if (line.contains(".isBlank()") && !line.contains("AppStringUtils.isBlank(")) {
            violations.add(formatViolation(sourceFile, lineNumber, "direct isBlank()"));
        }
        if (
            line.contains(".toLowerCase(") ||
            (line.contains(".toUpperCase(") && !line.contains("Character.toUpperCase("))
        ) {
            violations.add(formatViolation(sourceFile, lineNumber, "direct case conversion"));
        }
        if (
            (line.contains("StringUtils.") && !line.contains("AppStringUtils.")) ||
            (line.contains("ArrayUtils.") && !line.contains("AppArrayUtils."))
        ) {
            violations.add(formatViolation(sourceFile, lineNumber, "direct commons utility"));
        }
    }

    /**
     * 위반 메시지를 생성한다.
     *
     * @param sourceFile 검사 대상 파일
     * @param lineNumber 라인 번호
     * @param reason 위반 사유
     * @return 위반 메시지
     */
    private String formatViolation(Path sourceFile, int lineNumber, String reason) {
        return sourceFile + ":" + lineNumber + " - " + reason;
    }
}
