package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationResult;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.excel.ExcelData;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
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
public class DomainBulkService extends AbstractBulkService<DomainUploadRow> {

    private static final String ERROR_REPORT_ACCESSOR_ERROR = "Failed to resolve domain error report methods";

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;
    private final DomainBulkValidationSupport validationSupport = new DomainBulkValidationSupport(this::msg);
    private final DomainBulkExistingNameSupport existingNameSupport;
    private final DomainBulkSaveSupport saveSupport;

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
        this.dictionarySetService = dictionarySetService;
        this.existingNameSupport = new DomainBulkExistingNameSupport(domainRepository);
        this.saveSupport = new DomainBulkSaveSupport(domainRepository, existingNameSupport);
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

        final var existingNames = existingNameSupport.findExistingNames(
            dictionarySet,
            rawRows,
            validationSupport::resolveRowLogicalName
        );
        final var validationResult = validationSupport.validateRows(rawRows, existingNames, locale);

        final var session = validationResult.toSession(
            loginId,
            teamId,
            dictionarySet.getId(),
            Instant.now().plus(VALIDATION_SESSION_TTL)
        );
        final var validationToken = issueValidationToken(session);
        return validationResult.toResponse(validationToken, rawRows.size());
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
        final var session = consumeValidationSession(
            loginId,
            teamId,
            setId,
            validationToken,
            DomainBulkValidationSession.class
        );
        final var excludedRows = new HashSet<>(excludedRowNumbers);
        final var candidateRows = session
            .validRows()
            .stream()
            .filter((row) -> !excludedRows.contains(row.rowNumber()))
            .map(ValidatedDomainRow::row)
            .toList();
        return saveSupport.saveAll(team, dictionarySet, candidateRows);
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
        final var session = resolveValidationSession(
            loginId,
            teamId,
            setId,
            validationToken,
            DomainBulkValidationSession.class
        );

        return buildErrorReportExcel(
            session.errorRows(),
            DomainBulkErrorReportRow.class,
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
            BulkTemplateType.DOMAIN,
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
                new DomainBulkTemplateRow(
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
}
