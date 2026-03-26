package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 도메인 일괄 업로드 서비스.
 *
 * <p>엑셀/CSV 파일에서 도메인 데이터를 파싱하고 검증하며, 검증 통과한 도메인을 일괄 저장한다.
 * 기존 {@link DomainService}와 책임을 분리하여 단일 책임 원칙을 유지한다.</p>
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class DomainBulkService extends AbstractBulkService<DomainBulkService.DomainUploadRow> {

    private static final int DOMAIN_GROUP_MAX = 100;
    private static final int DOMAIN_CLASSIFICATION_MAX = 100;
    private static final int DATA_TYPE_MAX = 50;
    private static final int LOGICAL_NAME_QUERY_BATCH_SIZE = 5_000;
    private static final int PREVIEW_ROW_LIMIT = 2_000;
    private static final String ERROR_REPORT_ACCESSOR_ERROR = "Failed to resolve domain error report methods";

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * @param domainRepository 도메인 레포지토리
     * @param authService      인증 서비스
     * @param teamService      팀 서비스
     * @param messageSource    메시지 소스
     */
    public DomainBulkService(
        DomainRepository domainRepository,
        DictionarySetService dictionarySetService,
        BulkValidationSessionStore validationSessionStore,
        ObjectMapper objectMapper,
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource
    ) {
        super(authService, teamService, messageSource, validationSessionStore, objectMapper);
        this.domainRepository = domainRepository;
        this.dictionarySetService = dictionarySetService;
    }

    @Override
    protected Class<DomainUploadRow> uploadRowClass() {
        return DomainUploadRow.class;
    }

    @Override
    protected Map<String, String> mapUploadRow(DomainUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("domainGroup", nullToEmpty(row.getDomainGroup()));
        map.put("domainClassification", nullToEmpty(row.getDomainClassification()));
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("dataType", nullToEmpty(row.getDataType()));
        map.put("dataLength", nullToEmpty(row.getDataLength()));
        map.put("dataScale", nullToEmpty(row.getDataScale()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("domainGroup", fields.length > 0 ? fields[0] : "");
        map.put("domainClassification", fields.length > 1 ? fields[1] : "");
        map.put("logicalName", fields.length > 2 ? fields[2] : "");
        map.put("dataType", fields.length > 3 ? fields[3] : "");
        map.put("dataLength", fields.length > 4 ? fields[4] : "");
        map.put("dataScale", fields.length > 5 ? fields[5] : "");
        map.put("description", fields.length > 6 ? fields[6] : "");
        return map;
    }

    @Override
    protected List<String> excelColumnKeys() {
        return List.of(
            "domainGroup",
            "domainClassification",
            "logicalName",
            "dataType",
            "dataLength",
            "dataScale",
            "description"
        );
    }

    @Override
    protected String validationSessionKeyPrefix() {
        return "dict:bulk:validation:domain:";
    }

    /**
     * 업로드 파일에서 도메인 데이터를 파싱하고 검증한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param file    업로드 파일 (.xlsx 또는 .csv)
     * @param locale  요청 로케일
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

        final var fileName = file.getOriginalFilename();
        final var rawRows = parseFile(file, fileName);
        validateRowCount(rawRows);

        // DB 기존 표준 도메인명 일괄 조회
        final var existingNames = findExistingLogicalNames(
            rawRows.stream().map(this::resolveRowLogicalName).toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> domainRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Domain::getLogicalName
        );

        // 행별 검증
        final var validationResult = validateRows(rawRows, existingNames, locale);

        // 세션 생성 및 응답
        return createValidationResponse(loginId, teamId, dictionarySet.getId(), rawRows.size(), validationResult);
    }

    /**
     * 모든 행을 순회하며 필드 검증, 중복 검사를 수행하고 결과를 수집한다.
     *
     * @param rawRows       파싱된 행 목록
     * @param existingNames DB에 이미 존재하는 표준 도메인명 집합
     * @param locale        요청 로케일
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
            final var domainGroup = AppStringUtils.trimToEmpty(row.getOrDefault("domainGroup", ""));
            final var domainClassification = AppStringUtils.trimToEmpty(row.getOrDefault("domainClassification", ""));
            final var logicalName = AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""));
            final var dataType = AppStringUtils.trimToEmpty(row.getOrDefault("dataType", ""));
            final var dataLengthRaw = AppStringUtils.trimToEmpty(row.getOrDefault("dataLength", ""));
            final var dataScaleRaw = AppStringUtils.trimToEmpty(row.getOrDefault("dataScale", ""));
            final var description = AppStringUtils.trimToEmpty(row.getOrDefault("description", ""));

            final var errors = new ArrayList<String>();
            final var dataLength = parsePositiveInteger(
                dataLengthRaw,
                errors,
                locale,
                MessageCode.ERROR_BULK_VALIDATION_DATA_LENGTH_INVALID.code()
            );
            final var dataScale = parseNonNegativeInteger(
                dataScaleRaw,
                errors,
                locale,
                MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_INVALID.code()
            );
            final var generatedLogicalName = AppStringUtils.trimToEmpty(
                DomainLogicalNameSupport.resolve(logicalName, domainClassification, dataType, dataLength, dataScale)
            );

            errors.addAll(
                validateSingleRow(
                    domainGroup,
                    domainClassification,
                    generatedLogicalName,
                    dataType,
                    dataLengthRaw,
                    dataScaleRaw,
                    description,
                    dataLength,
                    dataScale,
                    seenNames,
                    existingNames,
                    locale
                )
            );

            final var data = new LinkedHashMap<String, String>();
            data.put("domainGroup", domainGroup);
            data.put("domainClassification", domainClassification);
            data.put("logicalName", generatedLogicalName);
            data.put("dataType", dataType);
            data.put("dataLength", dataLengthRaw);
            data.put("dataScale", dataScaleRaw);
            data.put("description", description);

            final var rowNumber = i + 2;
            final var valid = errors.isEmpty();
            final var previewRow = new BulkValidationRowResult(rowNumber, valid, errors, data);

            if (valid) {
                result.addValid(
                    previewRow,
                    new ValidatedDomainRow(
                        rowNumber,
                        new DomainBulkRow(
                            domainGroup,
                            domainClassification,
                            generatedLogicalName,
                            dataType,
                            dataLength,
                            dataScale,
                            description
                        )
                    )
                );
            } else {
                result.addError(
                    previewRow,
                    new DomainErrorReportRow(
                        rowNumber,
                        domainGroup,
                        domainClassification,
                        generatedLogicalName,
                        dataType,
                        dataLengthRaw,
                        dataScaleRaw,
                        description,
                        String.join("\n", errors)
                    )
                );
            }
        }
        return result;
    }

    /**
     * 단일 도메인 행의 필드 검증과 중복 검사를 수행한다.
     *
     * @param domainGroup 도메인 그룹
     * @param domainClassification 도메인명
     * @param logicalName   표준 도메인명
     * @param dataType 데이터 타입
     * @param dataLengthRaw 데이터 길이 원본 문자열
     * @param dataScaleRaw 데이터 소수점 길이 원본 문자열
     * @param description   설명
     * @param dataLength 파싱된 데이터 길이
     * @param dataScale 파싱된 데이터 소수점 길이
     * @param seenNames     파일 내 이미 등장한 표준 도메인명 집합 (변경됨)
     * @param existingNames DB에 존재하는 표준 도메인명 집합
     * @param locale        요청 로케일
     * @return 에러 메시지 목록 (비어있으면 유효)
     */
    private List<String> validateSingleRow(
        String domainGroup,
        String domainClassification,
        String logicalName,
        String dataType,
        String dataLengthRaw,
        String dataScaleRaw,
        String description,
        Integer dataLength,
        Integer dataScale,
        Set<String> seenNames,
        Set<String> existingNames,
        Locale locale
    ) {
        final var errors = new ArrayList<String>();

        if (domainGroup.length() > DOMAIN_GROUP_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DOMAIN_GROUP_MAX_LENGTH.code(), locale, DOMAIN_GROUP_MAX));
        }

        if (domainClassification.length() > DOMAIN_CLASSIFICATION_MAX) {
            errors.add(
                msg(
                    MessageCode.ERROR_BULK_VALIDATION_DOMAIN_CLASSIFICATION_MAX_LENGTH.code(),
                    locale,
                    DOMAIN_CLASSIFICATION_MAX
                )
            );
        }

        if (AppStringUtils.isBlank(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_REQUIRED.code(), locale));
        } else if (logicalName.length() > LOGICAL_NAME_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_LOGICAL_NAME_MAX_LENGTH.code(), locale, LOGICAL_NAME_MAX));
        }

        if (AppStringUtils.isBlank(dataType)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_TYPE_REQUIRED.code(), locale));
        } else if (dataType.length() > DATA_TYPE_MAX) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_TYPE_MAX_LENGTH.code(), locale, DATA_TYPE_MAX));
        }

        if (DomainPhysicalTypeSupport.requiresLength(dataType) && dataLength == null) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_LENGTH_REQUIRED_FOR_TYPE.code(), locale));
        }

        if (AppStringUtils.isNotBlank(dataScaleRaw) && AppStringUtils.isBlank(dataLengthRaw)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_REQUIRES_LENGTH.code(), locale));
        }

        if (DomainPhysicalTypeSupport.isScaleExceedsLength(dataLength, dataScale)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DATA_SCALE_INVALID.code(), locale));
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

    private Integer parsePositiveInteger(String value, List<String> errors, Locale locale, String errorCode) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            final var parsed = Integer.parseInt(normalized);
            if (parsed <= 0) {
                errors.add(msg(errorCode, locale));
                return null;
            }
            return parsed;
        } catch (NumberFormatException e) {
            errors.add(msg(errorCode, locale));
            return null;
        }
    }

    private Integer parseNonNegativeInteger(String value, List<String> errors, Locale locale, String errorCode) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            final var parsed = Integer.parseInt(normalized);
            if (parsed < 0) {
                errors.add(msg(errorCode, locale));
                return null;
            }
            return parsed;
        } catch (NumberFormatException e) {
            errors.add(msg(errorCode, locale));
            return null;
        }
    }

    private String resolveRowLogicalName(Map<String, String> row) {
        final var domainClassification = AppStringUtils.trimToNull(row.getOrDefault("domainClassification", ""));
        final var logicalName = AppStringUtils.trimToNull(row.getOrDefault("logicalName", ""));
        final var dataType = AppStringUtils.trimToNull(row.getOrDefault("dataType", ""));
        final var dataLength = parseIntegerQuietly(row.getOrDefault("dataLength", ""));
        final var dataScale = parseIntegerQuietly(row.getOrDefault("dataScale", ""));
        return AppStringUtils.defaultIfBlank(
            DomainLogicalNameSupport.resolve(logicalName, domainClassification, dataType, dataLength, dataScale),
            ""
        );
    }

    private Integer parseIntegerQuietly(String value) {
        final var normalized = AppStringUtils.trimToNull(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 검증 결과를 기반으로 Redis 세션을 저장하고 응답을 생성한다.
     *
     * @param loginId          요청 사용자 로그인 ID
     * @param teamId           팀 ID
     * @param setId            사전 세트 ID
     * @param totalRows        전체 행 수
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
     * 행 검증 결과를 누적하는 내부 데이터 홀더.
     */
    private static class RowValidationResult {

        final ArrayList<BulkValidationRowResult> errorPreviewRows;
        final ArrayList<BulkValidationRowResult> validPreviewRows;
        final ArrayList<ValidatedDomainRow> validRows = new ArrayList<>();
        final ArrayList<DomainErrorReportRow> errorRows = new ArrayList<>();
        int validCount = 0;
        int errorCount = 0;

        RowValidationResult(int estimatedSize) {
            this.errorPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
            this.validPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
        }

        void addValid(BulkValidationRowResult previewRow, ValidatedDomainRow validatedRow) {
            validCount++;
            validRows.add(validatedRow);
            if (validPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                validPreviewRows.add(previewRow);
            }
        }

        void addError(BulkValidationRowResult previewRow, DomainErrorReportRow errorReportRow) {
            errorCount++;
            errorRows.add(errorReportRow);
            if (errorPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                errorPreviewRows.add(previewRow);
            }
        }
    }

    /**
     * 검증 통과한 도메인을 일괄 저장한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 도메인 일괄 저장 요청
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
            .map(ValidatedDomainRow::row)
            .toList();

        // 기존 표준 도메인명 일괄 조회 (N+1 방지)
        final var existingNames = findExistingLogicalNames(
            candidateRows.stream().map(DomainBulkRow::logicalName).toList(),
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> domainRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Domain::getLogicalName
        );

        final var domainsToSave = new ArrayList<Domain>();
        var failedCount = 0;

        for (DomainBulkRow row : candidateRows) {
            if (existingNames.contains(row.logicalName())) {
                failedCount++;
                continue;
            }
            final var typeComponents = DomainPhysicalTypeSupport.fromStructured(
                row.dataType(),
                row.dataLength(),
                row.dataScale()
            );
            domainsToSave.add(
                Domain.builder()
                    .logicalName(row.logicalName())
                    .domainGroup(AppStringUtils.trimToNull(row.domainGroup()))
                    .domainClassification(AppStringUtils.trimToNull(row.domainClassification()))
                    .dataType(typeComponents.dataType())
                    .dataLength(typeComponents.dataLength())
                    .dataScale(typeComponents.dataScale())
                    .physicalType(typeComponents.physicalType())
                    .description(row.description())
                    .team(team)
                    .dictionarySet(dictionarySet)
                    .build()
            );
        }

        try {
            domainRepository.saveAll(domainsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResult(domainsToSave.size(), failedCount);
    }

    /**
     * 검증 실패 행을 엑셀로 다운로드한다.
     *
     * @param loginId         요청 사용자의 로그인 ID
     * @param teamId          팀 ID
     * @param setId           사전 세트 ID
     * @param validationToken 검증 세션 토큰
     * @param locale          요청 로케일
     * @return 오류 행 엑셀 데이터
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
            DomainErrorReportRow.class,
            "domain-upload-errors",
            locale,
            List.of(
                "bulk.error-report.col.row",
                "bulk.error-report.col.domain-group",
                "bulk.error-report.col.domain-classification",
                "bulk.error-report.col.logical-name",
                "bulk.error-report.col.data-type",
                "bulk.error-report.col.data-length",
                "bulk.error-report.col.data-scale",
                "bulk.error-report.col.description",
                "bulk.error-report.col.errors"
            ),
            List.of(
                "rowNumber",
                "domainGroup",
                "domainClassification",
                "logicalName",
                "dataType",
                "dataLength",
                "dataScale",
                "description",
                "errors"
            ),
            ERROR_REPORT_ACCESSOR_ERROR
        );
    }

    /**
     * 도메인 템플릿 엑셀을 생성한다.
     *
     * <p>Accept-Language 헤더에 따라 컬럼 헤더, 샘플 데이터, 가이드 시트가 해당 언어로 생성된다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param locale  요청 로케일
     * @return 엑셀 데이터
     */
    public ExcelData generateTemplate(String loginId, Long teamId, Long setId, @NonNull Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        return buildTemplateExcel(
            locale,
            TemplateType.DOMAIN,
            "template.domain.sheet-name",
            List.of(
                "template.domain.col.domain-group",
                "template.domain.col.domain-classification",
                "template.domain.col.logical-name",
                "template.domain.col.data-type",
                "template.domain.col.data-length",
                "template.domain.col.data-scale",
                "template.domain.col.description"
            ),
            List.of(
                new TemplateRow(
                    msg("template.domain.sample.domain-group", locale),
                    msg("template.domain.sample.domain-classification", locale),
                    msg("template.domain.sample.logical-name", locale),
                    msg("template.domain.sample.data-type", locale),
                    msg("template.domain.sample.data-length", locale),
                    msg("template.domain.sample.data-scale", locale),
                    msg("template.domain.sample.description", locale)
                )
            )
        );
    }

    /**
     * 엑셀 업로드용 임시 데이터 클래스.
     *
     * <p>ExcelUtils의 setter 기반 추출을 위해 필요한 POJO 클래스.</p>
     */
    @Getter
    @Setter
    public static class DomainUploadRow {

        private String domainGroup;
        private String domainClassification;
        private String logicalName;
        private String dataType;
        private String dataLength;
        private String dataScale;
        private String description;
    }

    /**
     * 검증 통과 후 저장 후보로 유지하는 도메인 행.
     *
     * @param rowNumber 원본 행 번호
     * @param row 저장 후보 도메인 행
     */
    private record ValidatedDomainRow(int rowNumber, DomainBulkRow row) {}

    /**
     * 벌크 저장 단계에서 사용하는 도메인 행 모델.
     *
     * @param logicalName 표준 도메인명
     * @param domainGroup 도메인 그룹
     * @param domainClassification 도메인명
     * @param dataType 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @param description 설명
     */
    private record DomainBulkRow(
        String domainGroup,
        String domainClassification,
        String logicalName,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String description
    ) {}

    /** 오류 보고서 엑셀 행. */
    public record DomainErrorReportRow(
        int rowNumber,
        String domainGroup,
        String domainClassification,
        String logicalName,
        String dataType,
        String dataLength,
        String dataScale,
        String description,
        String errors
    ) {}

    /** 검증 세션 저장 모델. */
    private record ValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        Instant expiresAt,
        List<ValidatedDomainRow> validRows,
        List<DomainErrorReportRow> errorRows,
        boolean saveConsumed
    ) implements SessionExpirable, SessionOwnership {}

    /** 템플릿 엑셀 생성용 행 데이터. */
    public record TemplateRow(
        String domainGroup,
        String domainClassification,
        String logicalName,
        String dataType,
        String dataLength,
        String dataScale,
        String description
    ) {}
}
