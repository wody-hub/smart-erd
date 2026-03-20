package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 용어 일괄 업로드 서비스.
 *
 * <p>엑셀/CSV 파일에서 용어 데이터를 파싱하고 검증하며, 검증 통과한 용어를 일괄 저장한다.
 * 기존 {@link TermService}와 책임을 분리하여 단일 책임 원칙을 유지한다.</p>
 */
@Slf4j
@Service
@Transactional(readOnly = true)
public class TermBulkService extends AbstractBulkService<TermBulkService.TermUploadRow> {

    private static final int PHYSICAL_NAME_MAX = 100;
    private static final int LOGICAL_NAME_QUERY_BATCH_SIZE = 5_000;
    private static final int PREVIEW_ROW_LIMIT = 2_000;
    private static final String ERROR_REPORT_ACCESSOR_ERROR = "Failed to resolve term error report methods";

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 레포지토리 (도메인 논리명 매핑) */
    private final DomainRepository domainRepository;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * @param termRepository   용어 레포지토리
     * @param domainRepository 도메인 레포지토리
     * @param authService      인증 서비스
     * @param teamService      팀 서비스
     * @param messageSource    메시지 소스
     */
    public TermBulkService(
        TermRepository termRepository,
        DomainRepository domainRepository,
        DictionarySetService dictionarySetService,
        BulkValidationSessionStore validationSessionStore,
        ObjectMapper objectMapper,
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource
    ) {
        super(authService, teamService, messageSource, validationSessionStore, objectMapper);
        this.termRepository = termRepository;
        this.domainRepository = domainRepository;
        this.dictionarySetService = dictionarySetService;
    }

    @Override
    protected Class<TermUploadRow> uploadRowClass() {
        return TermUploadRow.class;
    }

    @Override
    protected Map<String, String> mapUploadRow(TermUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalName", nullToEmpty(row.getPhysicalName()));
        map.put("domainLogicalName", nullToEmpty(row.getDomainLogicalName()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalName", fields.length > 1 ? fields[1] : "");
        map.put("domainLogicalName", fields.length > 2 ? fields[2] : "");
        map.put("description", fields.length > 3 ? fields[3] : "");
        return map;
    }

    @Override
    protected List<String> excelColumnKeys() {
        return List.of("logicalName", "physicalName", "domainLogicalName", "description");
    }

    @Override
    protected String validationSessionKeyPrefix() {
        return "dict:bulk:validation:term:";
    }

    /**
     * 업로드 파일에서 용어 데이터를 파싱하고 검증한다.
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

        // 팀 내 도메인 논리명 맵 구축
        final var domainMap = domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));

        // 행별 검증
        final var validationResult = validateRows(rawRows, domainMap, locale);

        // 세션 생성 및 응답
        return createValidationResponse(loginId, teamId, dictionarySet.getId(), rawRows.size(), validationResult);
    }

    /**
     * 모든 행을 순회하며 필드 검증, 도메인 참조 검사, 중복 검사를 수행하고 결과를 수집한다.
     *
     * @param rawRows   파싱된 행 목록
     * @param domainMap 사전 세트 내 도메인 논리명 맵
     * @param locale    요청 로케일
     * @return 검증 결과 누적 객체
     */
    private RowValidationResult validateRows(
        List<Map<String, String>> rawRows,
        Map<String, Domain> domainMap,
        Locale locale
    ) {
        final var seenNames = new HashSet<String>();
        final var result = new RowValidationResult(rawRows.size());

        for (var i = 0; i < rawRows.size(); i++) {
            final var row = rawRows.get(i);
            final var logicalName = AppStringUtils.trimToEmpty(row.getOrDefault("logicalName", ""));
            final var physicalName = AppStringUtils.trimToEmpty(row.getOrDefault("physicalName", ""));
            final var domainLogicalName = AppStringUtils.trimToEmpty(row.getOrDefault("domainLogicalName", ""));
            final var description = AppStringUtils.trimToEmpty(row.getOrDefault("description", ""));

            final var errors = validateSingleRow(
                logicalName,
                physicalName,
                domainLogicalName,
                description,
                seenNames,
                domainMap,
                locale
            );

            final var data = new LinkedHashMap<String, String>();
            data.put("logicalName", logicalName);
            data.put("physicalName", physicalName);
            data.put("domainLogicalName", domainLogicalName);
            data.put("description", description);

            final var rowNumber = i + 2;
            final var valid = errors.isEmpty();
            final var previewRow = new BulkValidationRowResult(rowNumber, valid, errors, data);

            if (valid) {
                result.addValid(
                    previewRow,
                    new ValidatedTermRow(
                        rowNumber,
                        new TermBulkRow(logicalName, physicalName, domainLogicalName, description)
                    )
                );
            } else {
                result.addError(
                    previewRow,
                    new TermErrorReportRow(
                        rowNumber,
                        logicalName,
                        physicalName,
                        domainLogicalName,
                        description,
                        String.join("\n", errors)
                    )
                );
            }
        }
        return result;
    }

    /**
     * 단일 용어 행의 필드 검증, 도메인 참조 검사, 중복 검사를 수행한다.
     *
     * @param logicalName       논리명
     * @param physicalName      물리명
     * @param domainLogicalName 도메인 논리명
     * @param description       설명
     * @param seenNames         파일 내 이미 등장한 논리명 집합 (변경됨)
     * @param domainMap         도메인 논리명 맵
     * @param locale            요청 로케일
     * @return 에러 메시지 목록 (비어있으면 유효)
     */
    private List<String> validateSingleRow(
        String logicalName,
        String physicalName,
        String domainLogicalName,
        String description,
        Set<String> seenNames,
        Map<String, Domain> domainMap,
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

        if (AppStringUtils.isNotBlank(domainLogicalName) && !domainMap.containsKey(domainLogicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DOMAIN_NOT_FOUND.code(), locale, domainLogicalName));
        }

        // 파일 내 중복 체크
        if (AppStringUtils.isNotBlank(logicalName) && !seenNames.add(logicalName)) {
            errors.add(msg(MessageCode.ERROR_BULK_VALIDATION_DUPLICATE_IN_FILE.code(), locale, logicalName));
        }
        // DB 중복은 오류로 처리하지 않고 저장 단계에서 upsert 대상으로 처리한다.

        return errors;
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
        final ArrayList<ValidatedTermRow> validRows = new ArrayList<>();
        final ArrayList<TermErrorReportRow> errorRows = new ArrayList<>();
        int validCount = 0;
        int errorCount = 0;

        RowValidationResult(int estimatedSize) {
            this.errorPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
            this.validPreviewRows = new ArrayList<>(Math.min(estimatedSize, PREVIEW_ROW_LIMIT));
        }

        void addValid(BulkValidationRowResult previewRow, ValidatedTermRow validatedRow) {
            validCount++;
            validRows.add(validatedRow);
            if (validPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                validPreviewRows.add(previewRow);
            }
        }

        void addError(BulkValidationRowResult previewRow, TermErrorReportRow errorReportRow) {
            errorCount++;
            errorRows.add(errorReportRow);
            if (errorPreviewRows.size() < PREVIEW_ROW_LIMIT) {
                errorPreviewRows.add(previewRow);
            }
        }
    }

    /**
     * 검증 통과한 용어를 일괄 저장한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 용어 일괄 저장 요청
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
        final var session = consumeValidationSession(
            loginId,
            teamId,
            setId,
            validationToken,
            ValidationSession.class
        );
        final var excludedRows = new HashSet<>(excludedRowNumbers);
        final var candidateRows = session
            .validRows()
            .stream()
            .filter((row) -> !excludedRows.contains(row.rowNumber()))
            .map(ValidatedTermRow::row)
            .toList();

        // 도메인 논리명 → 엔티티 맵
        final var domainMap = domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));

        // 기존 용어 일괄 조회 (upsert 대상)
        final var existingTermsByLogicalName = findExistingTermsByLogicalName(
            dictionarySet,
            candidateRows.stream().map(TermBulkRow::logicalName).toList()
        );

        final var termsToSave = new ArrayList<Term>();

        for (TermBulkRow row : candidateRows) {
            Domain domain = null;
            if (AppStringUtils.isNotBlank(row.domainLogicalName())) {
                domain = domainMap.get(row.domainLogicalName());
            }
            final var existing = existingTermsByLogicalName.get(row.logicalName());
            if (existing != null) {
                existing.update(row.logicalName(), row.physicalName(), domain, row.description());
                termsToSave.add(existing);
            } else {
                termsToSave.add(
                    Term.builder()
                        .logicalName(row.logicalName())
                        .physicalName(row.physicalName())
                        .description(row.description())
                        .team(team)
                        .dictionarySet(dictionarySet)
                        .domain(domain)
                        .build()
                );
            }
        }

        try {
            termRepository.saveAll(termsToSave);
        } catch (DataIntegrityViolationException e) {
            throw new DuplicateException(MessageCode.ERROR_BULK_CONCURRENT_DUPLICATE.code());
        }
        return new BulkSaveResult(termsToSave.size(), 0);
    }

    /**
     * 사전 세트 내 기존 용어를 논리명 기준으로 분할 조회한다.
     *
     * <p>대량 업로드 저장 시 DB IN 절 파라미터 한도 초과를 피하기 위해 일정 크기로 나누어 조회한다.</p>
     *
     * @param dictionarySet 사전 세트
     * @param logicalNames  조회 대상 논리명 목록
     * @return 논리명 기준 기존 용어 맵
     */
    private Map<String, Term> findExistingTermsByLogicalName(DictionarySet dictionarySet, List<String> logicalNames) {
        return findExistingByLogicalNames(
            logicalNames,
            LOGICAL_NAME_QUERY_BATCH_SIZE,
            (names) -> termRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, names),
            Term::getLogicalName
        );
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
            TermErrorReportRow.class,
            "term-upload-errors",
            locale,
            List.of(
                "bulk.error-report.col.row",
                "bulk.error-report.col.logical-name",
                "bulk.error-report.col.physical-name",
                "bulk.error-report.col.domain-logical-name",
                "bulk.error-report.col.description",
                "bulk.error-report.col.errors"
            ),
            List.of("rowNumber", "logicalName", "physicalName", "domainLogicalName", "description", "errors"),
            ERROR_REPORT_ACCESSOR_ERROR
        );
    }

    /**
     * 용어 템플릿 엑셀을 생성한다.
     *
     * <p>Accept-Language 헤더에 따라 컬럼 헤더, 샘플 데이터, 가이드 시트가 해당 언어로 생성된다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param locale  요청 로케일
     * @return 엑셀 데이터
     */
    public ExcelData generateTemplate(String loginId, Long teamId, Long setId, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        return buildTemplateExcel(
            locale,
            TemplateType.TERM,
            "template.term.sheet-name",
            List.of(
                "template.term.col.logical-name",
                "template.term.col.physical-name",
                "template.term.col.domain-logical-name",
                "template.term.col.description"
            ),
            List.of(
                new TemplateRow(
                    msg("template.term.sample.logical-name", locale),
                    msg("template.term.sample.physical-name", locale),
                    msg("template.term.sample.domain-logical-name", locale),
                    msg("template.term.sample.description", locale)
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
    public static class TermUploadRow {

        private String logicalName;
        private String physicalName;
        private String domainLogicalName;
        private String description;
    }

    /**
     * 검증 통과 후 저장 후보로 유지하는 용어 행.
     *
     * @param rowNumber 원본 행 번호
     * @param row 저장 후보 용어 행
     */
    private record ValidatedTermRow(int rowNumber, TermBulkRow row) {}

    /**
     * 벌크 저장 단계에서 사용하는 용어 행 모델.
     *
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param domainLogicalName 도메인 논리명
     * @param description 설명
     */
    private record TermBulkRow(String logicalName, String physicalName, String domainLogicalName, String description) {}

    /** 오류 보고서 엑셀 행. */
    public record TermErrorReportRow(
        int rowNumber,
        String logicalName,
        String physicalName,
        String domainLogicalName,
        String description,
        String errors
    ) {}

    /** 검증 세션 저장 모델. */
    private record ValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        Instant expiresAt,
        List<ValidatedTermRow> validRows,
        List<TermErrorReportRow> errorRows,
        boolean saveConsumed
    ) implements SessionExpirable, SessionOwnership {}

    /** 템플릿 엑셀 생성용 행 데이터. */
    public record TemplateRow(String logicalName, String physicalName, String domainLogicalName, String description) {}
}
