package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.dictionary.dto.BulkSaveResponse;
import com.smarterd.api.dictionary.dto.BulkValidationResponse;
import com.smarterd.api.dictionary.dto.BulkValidationRow;
import com.smarterd.api.dictionary.dto.BulkWordRow;
import com.smarterd.api.dictionary.dto.BulkWordSaveRequest;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Word;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class WordBulkService extends AbstractBulkService<WordBulkService.WordUploadRow> {

    private static final int PHYSICAL_NAME_MAX = 100;
    private static final int LOGICAL_NAME_QUERY_BATCH_SIZE = 5_000;
    private static final int PREVIEW_ROW_LIMIT = 2_000;
    private static final String ERROR_REPORT_ACCESSOR_ERROR = "Failed to resolve word error report methods";

    private final WordRepository wordRepository;
    private final DictionarySetService dictionarySetService;

    public WordBulkService(
        WordRepository wordRepository,
        DictionarySetService dictionarySetService,
        BulkValidationSessionStore validationSessionStore,
        ObjectMapper objectMapper,
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource
    ) {
        super(authService, teamService, messageSource, validationSessionStore, objectMapper);
        this.wordRepository = wordRepository;
        this.dictionarySetService = dictionarySetService;
    }

    @Override
    protected Class<WordUploadRow> uploadRowClass() {
        return WordUploadRow.class;
    }

    @Override
    protected Map<String, String> mapUploadRow(WordUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalName", nullToEmpty(row.getPhysicalName()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalName", fields.length > 1 ? fields[1] : "");
        map.put("description", fields.length > 2 ? fields[2] : "");
        return map;
    }

    @Override
    protected List<String> excelColumnKeys() {
        return List.of("logicalName", "physicalName", "description");
    }

    @Override
    protected String validationSessionKeyPrefix() {
        return "dict:bulk:validation:word:";
    }

    public BulkValidationResponse validateUpload(String loginId, Long teamId, Long setId, MultipartFile file, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        final var rawRows = parseFile(file, file.getOriginalFilename());
        validateRowCount(rawRows);

        final var existingNames = findExistingLogicalNames(
            rawRows.stream().map((row) -> AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""))).toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> wordRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Word::getLogicalName
        );
        final var validationResult = validateRows(rawRows, existingNames, locale);
        return createValidationResponse(loginId, teamId, dictionarySet.getId(), rawRows.size(), validationResult);
    }

    @Transactional
    public BulkSaveResponse bulkSave(String loginId, Long teamId, Long setId, BulkWordSaveRequest request) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        final var session = consumeValidationSession(loginId, teamId, setId, request.validationToken(), ValidationSession.class);
        final var excludedRowNumbers = new HashSet<>(request.excludedRowNumbers());
        final var candidateRows = session.validRows()
            .stream()
            .filter((row) -> !excludedRowNumbers.contains(row.rowNumber()))
            .map(ValidatedWordRow::row)
            .toList();

        final var existingNames = findExistingLogicalNames(
            candidateRows.stream().map(BulkWordRow::logicalName).toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> wordRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Word::getLogicalName
        );

        final var wordsToSave = new ArrayList<Word>();
        var failedCount = 0;
        for (final var row : candidateRows) {
            if (existingNames.contains(row.logicalName())) {
                failedCount++;
                continue;
            }
            wordsToSave.add(
                Word.builder()
                    .logicalName(row.logicalName())
                    .physicalName(row.physicalName())
                    .description(row.description())
                    .team(team)
                    .dictionarySet(dictionarySet)
                    .build()
            );
        }

        try {
            wordRepository.saveAll(wordsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResponse(wordsToSave.size(), failedCount);
    }

    public ExcelData generateErrorReport(String loginId, Long teamId, Long setId, String validationToken, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);
        final var session = resolveValidationSession(loginId, teamId, setId, validationToken, ValidationSession.class);

        return buildErrorReportExcel(
            session.errorRows(),
            WordErrorReportRow.class,
            "word-upload-errors",
            locale,
            List.of(
                "bulk.error-report.col.row",
                "bulk.error-report.col.logical-name",
                "bulk.error-report.col.physical-name",
                "bulk.error-report.col.description",
                "bulk.error-report.col.errors"
            ),
            List.of("rowNumber", "logicalName", "physicalName", "description", "errors"),
            ERROR_REPORT_ACCESSOR_ERROR
        );
    }

    public ExcelData generateTemplate(String loginId, Long teamId, Long setId, @NonNull Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        return buildTemplateExcel(
            locale,
            TemplateType.WORD,
            "template.word.sheet-name",
            List.of(
                "template.word.col.logical-name",
                "template.word.col.physical-name",
                "template.word.col.description"
            ),
            List.of(
                new TemplateRow(
                    msg("template.word.sample.logical-name", locale),
                    msg("template.word.sample.physical-name", locale),
                    msg("template.word.sample.description", locale)
                )
            )
        );
    }

    private RowValidationResult validateRows(List<Map<String, String>> rawRows, Set<String> existingNames, Locale locale) {
        final var seenNames = new HashSet<String>();
        final var result = new RowValidationResult(rawRows.size());

        for (var i = 0; i < rawRows.size(); i++) {
            final var row = rawRows.get(i);
            final var logicalName = AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""));
            final var physicalName = AppStringUtils.trimToEmpty(row.getOrDefault("physicalName", ""));
            final var description = AppStringUtils.trimToEmpty(row.getOrDefault("description", ""));
            final var errors = validateSingleRow(logicalName, physicalName, description, seenNames, existingNames, locale);

            final var data = new LinkedHashMap<String, String>();
            data.put("logicalName", logicalName);
            data.put("physicalName", physicalName);
            data.put("description", description);

            final var rowNumber = i + 2;
            final var valid = errors.isEmpty();
            final var previewRow = new BulkValidationRow(rowNumber, valid, errors, data);
            if (valid) {
                result.addValid(previewRow, new ValidatedWordRow(rowNumber, new BulkWordRow(logicalName, physicalName, description)));
            } else {
                result.addError(previewRow, new WordErrorReportRow(rowNumber, logicalName, physicalName, description, String.join("\n", errors)));
            }
        }

        return result;
    }

    private List<String> validateSingleRow(
        String logicalName,
        String physicalName,
        String description,
        Set<String> seenNames,
        Set<String> existingNames,
        Locale locale
    ) {
        final var errors = new ArrayList<String>();
        if (AppStringUtils.isBlank(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED.code(), locale));
        } else if (logicalName.length() > LOGICAL_NAME_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH.code(), locale, LOGICAL_NAME_MAX));
        }
        if (AppStringUtils.isBlank(physicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_REQUIRED.code(), locale));
        } else if (physicalName.length() > PHYSICAL_NAME_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_MAX_LENGTH.code(), locale, PHYSICAL_NAME_MAX));
        }
        if (description.length() > DESCRIPTION_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DESCRIPTION_MAX_LENGTH.code(), locale, DESCRIPTION_MAX));
        }
        if (AppStringUtils.isNotBlank(logicalName) && !seenNames.add(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE.code(), locale, logicalName));
        }
        if (AppStringUtils.isNotBlank(logicalName) && existingNames.contains(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_DB.code(), locale, logicalName));
        }
        return errors;
    }

    private BulkValidationResponse createValidationResponse(
        String loginId,
        Long teamId,
        Long setId,
        int totalRows,
        RowValidationResult validationResult
    ) {
        final var previewRows = mergePreviewRows(validationResult.errorPreviewRows, validationResult.validPreviewRows, PREVIEW_ROW_LIMIT);
        final var session = new ValidationSession(
            loginId,
            teamId,
            setId,
            Instant.now().plus(VALIDATION_SESSION_TTL),
            List.copyOf(validationResult.validRows),
            List.copyOf(validationResult.errorRows),
            false
        );
        final var validationToken = issueValidationToken(session);
        return new BulkValidationResponse(
            validationToken,
            totalRows,
            validationResult.validCount,
            validationResult.errorCount,
            totalRows > previewRows.size(),
            previewRows
        );
    }

    private static class RowValidationResult {
        final ArrayList<BulkValidationRow> errorPreviewRows;
        final ArrayList<BulkValidationRow> validPreviewRows;
        final ArrayList<ValidatedWordRow> validRows = new ArrayList<>();
        final ArrayList<WordErrorReportRow> errorRows = new ArrayList<>();
        int validCount = 0;
        int errorCount = 0;

        RowValidationResult(int estimatedSize) {
            this.errorPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
            this.validPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
        }

        void addValid(BulkValidationRow previewRow, ValidatedWordRow validatedRow) {
            validCount++;
            validRows.add(validatedRow);
            if (validPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                validPreviewRows.add(previewRow);
            }
        }

        void addError(BulkValidationRow previewRow, WordErrorReportRow errorReportRow) {
            errorCount++;
            errorRows.add(errorReportRow);
            if (errorPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                errorPreviewRows.add(previewRow);
            }
        }
    }

    private record ValidatedWordRow(int rowNumber, BulkWordRow row) {}

    public record WordErrorReportRow(
        int rowNumber,
        String logicalName,
        String physicalName,
        String description,
        String errors
    ) {}

    private record ValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        Instant expiresAt,
        List<ValidatedWordRow> validRows,
        List<WordErrorReportRow> errorRows,
        boolean saveConsumed
    ) implements SessionExpirable, SessionOwnership {}

    public record TemplateRow(String logicalName, String physicalName, String description) {}

    @Getter
    @Setter
    public static class WordUploadRow {
        private String logicalName;
        private String physicalName;
        private String description;
    }
}
