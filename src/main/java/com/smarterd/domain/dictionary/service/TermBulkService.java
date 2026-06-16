package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.service.BulkModels.BulkSaveResult;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationResult;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.excel.ExcelData;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 용어 일괄 업로드 서비스.
 *
 * <p>엑셀/CSV 파일에서 용어 데이터를 파싱하고 검증하며, 검증 통과한 용어를 일괄 저장한다.
 * 기존 {@link TermService}와 책임을 분리하여 단일 책임 원칙을 유지한다.</p>
 */
@Service
@Transactional(readOnly = true)
public class TermBulkService extends AbstractBulkService<TermBulkService.TermUploadRow> {

    private static final String ERROR_REPORT_ACCESSOR_ERROR = "Failed to resolve term error report methods";

    /** 도메인 레포지토리 (도메인 논리명 매핑) */
    private final DomainRepository domainRepository;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;
    private final TermBulkValidationSupport validationSupport = new TermBulkValidationSupport(this::msg);
    private final TermBulkSaveSupport saveSupport;

    /**
     * @param termRepository 용어 레포지토리
     * @param domainRepository 도메인 레포지토리
     * @param dictionarySetService 사전 세트 서비스
     * @param validationSessionStore 벌크 검증 세션 저장소
     * @param objectMapper JSON 직렬화/역직렬화
     * @param authService 인증 서비스
     * @param teamService 팀 서비스
     * @param messageSource 메시지 소스
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
        this.domainRepository = domainRepository;
        this.dictionarySetService = dictionarySetService;
        this.saveSupport = new TermBulkSaveSupport(termRepository, domainRepository);
    }

    /** {@inheritDoc} */
    @Override
    protected Class<TermUploadRow> uploadRowClass() {
        return TermUploadRow.class;
    }

    /** {@inheritDoc} */
    @Override
    protected Map<String, String> mapUploadRow(TermUploadRow row) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", nullToEmpty(row.getLogicalName()));
        map.put("physicalName", nullToEmpty(row.getPhysicalName()));
        map.put("domainLogicalName", nullToEmpty(row.getDomainLogicalName()));
        map.put("description", nullToEmpty(row.getDescription()));
        return map;
    }

    /** {@inheritDoc} */
    @Override
    protected Map<String, String> mapCsvFields(String[] fields) {
        final var map = new HashMap<String, String>();
        map.put("logicalName", fields.length > 0 ? fields[0] : "");
        map.put("physicalName", fields.length > 1 ? fields[1] : "");
        map.put("domainLogicalName", fields.length > 2 ? fields[2] : "");
        map.put("description", fields.length > 3 ? fields[3] : "");
        return map;
    }

    /** {@inheritDoc} */
    @Override
    protected List<String> excelColumnKeys() {
        return List.of("logicalName", "physicalName", "domainLogicalName", "description");
    }

    /** {@inheritDoc} */
    @Override
    protected String validationSessionKeyPrefix() {
        return "dict:bulk:validation:term:";
    }

    /**
     * 업로드 파일에서 용어 데이터를 파싱하고 검증한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param file 업로드 파일 (.xlsx 또는 .csv)
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

        final var validationResult = validationSupport.validateRows(rawRows, domainMap(dictionarySet), locale);
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
     * 검증 통과한 용어를 일괄 저장한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param validationToken 검증 토큰
     * @param excludedRowNumbers 저장 제외 행 번호
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
            TermBulkValidationSession.class
        );
        final var candidateRows = session
            .validRows()
            .stream()
            .filter((row) -> !excludedRowNumbers.contains(row.rowNumber()))
            .map(ValidatedTermRow::row)
            .toList();
        return saveSupport.saveAll(team, dictionarySet, candidateRows);
    }

    /**
     * 검증 실패 행을 엑셀로 다운로드한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param validationToken 검증 세션 토큰
     * @param locale 요청 로케일
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
            TermBulkValidationSession.class
        );

        return buildErrorReportExcel(
            session.errorRows(),
            TermBulkErrorReportRow.class,
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
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param locale 요청 로케일
     * @return 엑셀 데이터
     */
    public ExcelData generateTemplate(String loginId, Long teamId, Long setId, Locale locale) {
        final var team = verifyTeamAccess(loginId, teamId);
        dictionarySetService.findByTeamAndId(team, setId);

        return buildTemplateExcel(
            locale,
            BulkTemplateType.TERM,
            "template.term.sheet-name",
            List.of(
                "template.term.col.logical-name",
                "template.term.col.physical-name",
                "template.term.col.domain-logical-name",
                "template.term.col.description"
            ),
            List.of(
                new TermBulkTemplateRow(
                    msg("template.term.sample.logical-name", locale),
                    msg("template.term.sample.physical-name", locale),
                    msg("template.term.sample.domain-logical-name", locale),
                    msg("template.term.sample.description", locale)
                )
            )
        );
    }

    /**
     * 사전 세트에 속한 도메인을 논리명 기준으로 반환한다.
     *
     * @param dictionarySet 사전 세트
     * @return 도메인 논리명 맵
     */
    private Map<String, Domain> domainMap(DictionarySet dictionarySet) {
        return domainRepository
            .findByDictionarySet(dictionarySet)
            .stream()
            .collect(Collectors.toMap(Domain::getLogicalName, Function.identity()));
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
}
