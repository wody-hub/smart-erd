package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Word;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
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

    /** 단어 레포지토리 */
    private final WordRepository wordRepository;
    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * @param wordRepository 단어 레포지토리
     * @param dictionarySetService 사전 세트 서비스
     * @param validationSessionStore 벌크 검증 세션 저장소
     * @param objectMapper JSON 직렬화/역직렬화
     * @param authService 인증 서비스
     * @param teamService 팀 서비스
     * @param messageSource 메시지 소스
     */
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

    /** {@inheritDoc} */
    @Override
    protected Class<WordUploadRow> uploadRowClass() {
        return WordUploadRow.class;
    }

    /** {@inheritDoc} */
    @Override
    protected Map<String, String> mapUploadRow(WordUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalName", nullToEmpty(row.getPhysicalName()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    /** {@inheritDoc} */
    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalName", fields.length > 1 ? fields[1] : "");
        map.put("description", fields.length > 2 ? fields[2] : "");
        return map;
    }

    /** {@inheritDoc} */
    @Override
    protected List<String> excelColumnKeys() {
        return List.of("logicalName", "physicalName", "description");
    }

    /** {@inheritDoc} */
    @Override
    protected String validationSessionKeyPrefix() {
        return "dict:bulk:validation:word:";
    }

    /**
     * 업로드 파일에서 단어 데이터를 파싱하고 검증한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param file 업로드 파일
     * @param locale 요청 로케일
     * @return 검증 결과 응답
     */
    public BulkValidationResult validateUpload(
        String loginId,
        Long teamId,
        Long setId,
        MultipartFile file,
        Locale locale
    ) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        final var rawRows = parseFile(file, file.getOriginalFilename());
        validateRowCount(rawRows);

        final var existingNames = BulkLogicalNameLookupSupport.findExistingByLogicalNames(
            rawRows
                .stream()
                .map((row) -> AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", "")))
                .toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> wordRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Word::getLogicalName
        ).keySet();
        final var validationResult = validateRows(rawRows, existingNames, locale);
        return createValidationResponse(loginId, teamId, dictionarySet.getId(), rawRows.size(), validationResult);
    }

    /**
     * 검증을 통과한 단어를 일괄 저장한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param request 일괄 저장 요청
     * @return 저장 결과 응답
     */
    @Transactional
    public BulkSaveResult bulkSave(
        String loginId,
        Long teamId,
        Long setId,
        String validationToken,
        List<Integer> excludedRowNumbers
    ) {
        final var team = verifyTeamAccess(loginId, teamId);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        final var session = consumeValidationSession(loginId, teamId, setId, validationToken, ValidationSession.class);
        final var excludedRows = new HashSet<>(excludedRowNumbers);
        final var candidateRows = session
            .validRows()
            .stream()
            .filter((row) -> !excludedRows.contains(row.rowNumber()))
            .map(ValidatedWordRow::row)
            .toList();

        final var existingNames = BulkLogicalNameLookupSupport.findExistingByLogicalNames(
            candidateRows.stream().map(WordBulkRow::logicalName).toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> wordRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Word::getLogicalName
        ).keySet();

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
        return new BulkSaveResult(wordsToSave.size(), failedCount);
    }

    /**
     * 검증 실패 행을 엑셀 오류 리포트로 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param validationToken 검증 세션 토큰
     * @param locale 요청 로케일
     * @return 오류 리포트 엑셀 데이터
     */
    public ExcelData generateErrorReport(
        String loginId,
        Long teamId,
        Long setId,
        String validationToken,
        Locale locale
    ) {
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

    /**
     * 단어 업로드용 템플릿 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param locale 요청 로케일
     * @return 템플릿 엑셀 데이터
     */
    public ExcelData generateTemplate(String loginId, Long teamId, Long setId, @NonNull Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        return buildTemplateExcel(
            locale,
            BulkTemplateType.WORD,
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

    /**
     * 모든 행을 순회하며 단어 검증 결과를 누적한다.
     *
     * @param rawRows 파싱된 행 목록
     * @param existingNames DB에 이미 존재하는 논리명 집합
     * @param locale 요청 로케일
     * @return 검증 결과 누적 객체
     */
    private RowValidationResult validateRows(
        List<Map<String, String>> rawRows,
        Set<String> existingNames,
        Locale locale
    ) {
        final var seenNames = new HashSet<String>();
        final var result = new RowValidationResult(rawRows.size());

        for (var i = 0; i < rawRows.size(); i++) {
            final var row = rawRows.get(i);
            final var logicalName = AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""));
            final var physicalName = AppStringUtils.trimToEmpty(row.getOrDefault("physicalName", ""));
            final var description = AppStringUtils.trimToEmpty(row.getOrDefault("description", ""));
            final var errors = validateSingleRow(
                logicalName,
                physicalName,
                description,
                seenNames,
                existingNames,
                locale
            );

            final var data = new LinkedHashMap<String, String>();
            data.put("logicalName", logicalName);
            data.put("physicalName", physicalName);
            data.put("description", description);

            final var rowNumber = i + 2;
            final var valid = errors.isEmpty();
            final var previewRow = new BulkValidationRowResult(rowNumber, valid, errors, data);
            if (valid) {
                result.addValid(
                    previewRow,
                    new ValidatedWordRow(rowNumber, new WordBulkRow(logicalName, physicalName, description))
                );
            } else {
                result.addError(
                    previewRow,
                    new WordErrorReportRow(rowNumber, logicalName, physicalName, description, String.join("\n", errors))
                );
            }
        }

        return result;
    }

    /**
     * 단일 단어 행의 필드 검증과 중복 검사를 수행한다.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     * @param seenNames 파일 내 이미 등장한 논리명 집합
     * @param existingNames DB에 이미 존재하는 논리명 집합
     * @param locale 요청 로케일
     * @return 에러 메시지 목록
     */
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
            errors.add(
                msg(MessageCode.ERROR_BULK_VALIDATION_PHYSICAL_NAME_MAX_LENGTH.code(), locale, PHYSICAL_NAME_MAX)
            );
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

    /**
     * 검증 결과와 세션 토큰을 포함한 응답을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param totalRows 전체 행 수
     * @param validationResult 검증 결과 누적 객체
     * @return 검증 결과 응답
     */
    private BulkValidationResult createValidationResponse(
        String loginId,
        Long teamId,
        Long setId,
        int totalRows,
        RowValidationResult validationResult
    ) {
        final var previewRows = mergePreviewRows(
            validationResult.errorPreviewRows,
            validationResult.validPreviewRows,
            PREVIEW_ROW_LIMIT
        );
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
        return new BulkValidationResult(
            validationToken,
            totalRows,
            validationResult.validCount,
            validationResult.errorCount,
            totalRows > previewRows.size(),
            previewRows
        );
    }

    /**
     * 검증 과정 중 누적되는 유효/오류 행 상태를 보관한다.
     */
    private static class RowValidationResult {

        final ArrayList<BulkValidationRowResult> errorPreviewRows;
        final ArrayList<BulkValidationRowResult> validPreviewRows;
        final ArrayList<ValidatedWordRow> validRows = new ArrayList<>();
        final ArrayList<WordErrorReportRow> errorRows = new ArrayList<>();
        int validCount = 0;
        int errorCount = 0;

        RowValidationResult(int estimatedSize) {
            this.errorPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
            this.validPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
        }

        /**
         * 유효 행을 누적한다.
         *
         * @param previewRow 프리뷰 행
         * @param validatedRow 저장 후보 행
         */
        void addValid(BulkValidationRowResult previewRow, ValidatedWordRow validatedRow) {
            validCount++;
            validRows.add(validatedRow);
            if (validPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                validPreviewRows.add(previewRow);
            }
        }

        /**
         * 오류 행을 누적한다.
         *
         * @param previewRow 프리뷰 행
         * @param errorReportRow 오류 리포트 행
         */
        void addError(BulkValidationRowResult previewRow, WordErrorReportRow errorReportRow) {
            errorCount++;
            errorRows.add(errorReportRow);
            if (errorPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                errorPreviewRows.add(previewRow);
            }
        }
    }

    /**
     * 검증을 통과한 업로드 행 정보.
     *
     * @param rowNumber 원본 엑셀/CSV 행 번호
     * @param row 저장 후보 단어 행
     */
    private record ValidatedWordRow(int rowNumber, WordBulkRow row) {}

    /**
     * 벌크 저장 단계에서 사용하는 단어 행 모델.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     */
    private record WordBulkRow(String logicalName, String physicalName, String description) {}

    /**
     * 오류 리포트 엑셀 행 모델.
     *
     * @param rowNumber 행 번호
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     * @param errors 오류 메시지 묶음
     */
    public record WordErrorReportRow(
        int rowNumber,
        String logicalName,
        String physicalName,
        String description,
        String errors
    ) {}

    /**
     * Redis/메모리 검증 세션 payload 모델.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param expiresAt 만료 시각
     * @param validRows 유효 행 목록
     * @param errorRows 오류 행 목록
     * @param saveConsumed 저장 토큰 사용 여부
     */
    private record ValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        Instant expiresAt,
        List<ValidatedWordRow> validRows,
        List<WordErrorReportRow> errorRows,
        boolean saveConsumed
    ) implements BulkValidationSessionExpirable, BulkValidationSessionOwnership {}

    /**
     * 템플릿 엑셀 예시 행 모델.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     */
    public record TemplateRow(String logicalName, String physicalName, String description) {}

    /**
     * 엑셀 업로드용 단어 행 매핑 POJO.
     */
    @Getter
    @Setter
    public static class WordUploadRow {

        private String logicalName;
        private String physicalName;
        private String description;
    }
}
