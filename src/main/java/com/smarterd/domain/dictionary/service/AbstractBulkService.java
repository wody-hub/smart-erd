package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.MessageSource;
import org.springframework.web.multipart.MultipartFile;

/**
 * 일괄 업로드 서비스의 공통 오케스트레이션을 제공하는 추상 클래스.
 *
 * <p>파일 파싱, 세션 관리, 엑셀 생성의 세부 구현은 전용 support 클래스로 위임하고,
 * 하위 서비스는 행 매핑과 도메인별 검증/저장 흐름에만 집중한다.</p>
 *
 * @param <R> 엑셀 업로드용 POJO 행 타입
 */
public abstract class AbstractBulkService<R> {

    protected static final int MAX_ROWS = 100_000;
    protected static final int LOGICAL_NAME_MAX = 100;
    protected static final int DESCRIPTION_MAX = 500;
    protected static final Duration VALIDATION_SESSION_TTL = Duration.ofMinutes(10);

    private final AuthService authService;
    private final TeamService teamService;
    private final MessageSource messageSource;
    private final BulkValidationSessionManager validationSessionManager;
    private final BulkExcelReportSupport excelReportSupport = new BulkExcelReportSupport();
    private final BulkTemplateExcelSupport templateExcelSupport = new BulkTemplateExcelSupport(MAX_ROWS);

    protected AbstractBulkService(
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource,
        BulkValidationSessionStore validationSessionStore,
        ObjectMapper objectMapper
    ) {
        this.authService = authService;
        this.teamService = teamService;
        this.messageSource = messageSource;
        this.validationSessionManager = new BulkValidationSessionManager(validationSessionStore, objectMapper);
    }

    /**
     * 엑셀 업로드 행 POJO 클래스를 반환한다.
     *
     * @return 엑셀 업로드 행 클래스
     */
    protected abstract Class<R> uploadRowClass();

    /**
     * 엑셀 업로드 행을 필드 이름과 값의 맵으로 변환한다.
     *
     * @param row 엑셀 업로드 행
     * @return 필드 맵
     */
    protected abstract Map<String, String> mapUploadRow(R row);

    /**
     * CSV 필드 배열을 필드 이름과 값의 맵으로 변환한다.
     *
     * @param fields CSV 필드 배열
     * @return 필드 맵
     */
    protected abstract Map<String, String> mapCsvFields(String[] fields);

    /**
     * 검증 세션 Redis 키의 접두사를 반환한다.
     *
     * @return Redis 키 접두사
     */
    protected abstract String validationSessionKeyPrefix();

    /** @return 엑셀 컬럼 키 순서 */
    protected List<String> excelColumnKeys() {
        return List.of();
    }

    /**
     * 팀 접근 권한을 검증하고 팀 엔티티를 반환한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @return 검증된 팀 엔티티
     */
    protected Team verifyTeamAccess(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        return team;
    }

    /**
     * 업로드 파일을 파싱하여 행별 필드 맵 목록을 반환한다.
     *
     * @param file 업로드 파일
     * @param fileName 원본 파일명
     * @return 파싱된 행 목록
     */
    protected List<Map<String, String>> parseFile(MultipartFile file, String fileName) {
        return new BulkFileParsingSupport<>(
            uploadRowClass(),
            excelColumnKeys(),
            this::mapUploadRow,
            this::mapCsvFields
        ).parseFile(file, fileName);
    }

    /**
     * 에러 프리뷰 행과 유효 프리뷰 행을 병합한다.
     *
     * @param errorPreviewRows 에러 프리뷰 행 목록
     * @param validPreviewRows 유효 프리뷰 행 목록
     * @param limit 프리뷰 최대 행 수
     * @return 병합된 프리뷰 행 목록
     */
    protected List<BulkValidationRowResult> mergePreviewRows(
        List<BulkValidationRowResult> errorPreviewRows,
        List<BulkValidationRowResult> validPreviewRows,
        int limit
    ) {
        return BulkValidationPreviewSupport.mergePreviewRows(errorPreviewRows, validPreviewRows, limit);
    }

    /** @param value 문자열 @return 빈 문자열 또는 원본 값 */
    protected String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * 행 수를 검증한다.
     *
     * @param rawRows 파싱된 행 목록
     */
    protected void validateRowCount(List<Map<String, String>> rawRows) {
        if (rawRows.isEmpty()) {
            throw new BusinessException(MessageCode.ERROR_BULK_EMPTY_FILE.code());
        }
        if (rawRows.size() > MAX_ROWS) {
            throw new BusinessException(MessageCode.ERROR_BULK_TOO_MANY_ROWS.code(), MAX_ROWS);
        }
    }

    /**
     * 메시지 코드를 해석하여 다국어 메시지를 반환한다.
     *
     * @param code 메시지 코드
     * @param locale 로케일
     * @param args 메시지 인자
     * @return 해석된 메시지 문자열
     */
    protected String msg(String code, Locale locale, Object... args) {
        final var nonNullCode = Objects.requireNonNull(code, "code must not be null");
        final var nonNullLocale = Objects.requireNonNull(locale, "locale must not be null");
        return messageSource.getMessage(nonNullCode, args, nonNullLocale);
    }

    /**
     * 단일 시트 오류 리포트 엑셀을 생성한다.
     *
     * @param rows 오류 행 목록
     * @param rowClass 오류 행 타입
     * @param filePrefix 파일명 prefix
     * @param locale 로케일
     * @param titleCodes 컬럼 제목 메시지 코드
     * @param accessorNames record accessor 이름 순서
     * @param accessorError accessor 해석 실패 메시지
     * @param <T> 오류 행 타입
     * @return 엑셀 데이터
     */
    protected <T> ExcelData buildErrorReportExcel(
        List<T> rows,
        Class<T> rowClass,
        String filePrefix,
        Locale locale,
        List<String> titleCodes,
        List<String> accessorNames,
        String accessorError
    ) {
        return excelReportSupport.buildErrorReportExcel(
            rows,
            rowClass,
            filePrefix,
            locale,
            titleCodes,
            accessorNames,
            accessorError,
            this::msg
        );
    }

    /**
     * 데이터 시트와 가이드 시트를 포함한 템플릿 엑셀을 생성한다.
     *
     * @param locale 로케일
     * @param templateType 템플릿 유형
     * @param sheetNameCode 데이터 시트명 메시지 코드
     * @param titleCodes 컬럼 제목 메시지 코드
     * @param sampleRows 샘플 데이터
     * @param <T> 템플릿 행 타입
     * @return 엑셀 데이터
     */
    protected <T> ExcelData buildTemplateExcel(
        Locale locale,
        BulkTemplateType templateType,
        String sheetNameCode,
        List<String> titleCodes,
        List<T> sampleRows
    ) {
        return templateExcelSupport.buildTemplateExcel(
            locale,
            templateType,
            sheetNameCode,
            titleCodes,
            sampleRows,
            this::msg
        );
    }

    /**
     * 세션 객체를 저장하고 고유 검증 토큰을 발급한다.
     *
     * @param session 직렬화할 세션 객체
     * @return 발급된 토큰 문자열
     */
    protected String issueValidationToken(Object session) {
        return validationSessionManager.issueValidationToken(validationSessionKeyPrefix(), session);
    }

    /**
     * 검증 토큰을 소비하여 세션을 반환한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param token 검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S> 세션 타입
     * @return 검증 세션 객체
     */
    protected <S> S consumeValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        return validationSessionManager.consumeValidationSession(
            validationSessionKeyPrefix(),
            loginId,
            teamId,
            setId,
            token,
            sessionClass
        );
    }

    /**
     * 검증 토큰으로 세션을 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param token 검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S> 세션 타입
     * @return 검증 세션 객체
     */
    protected <S> S resolveValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        return validationSessionManager.resolveValidationSession(
            validationSessionKeyPrefix(),
            loginId,
            teamId,
            setId,
            token,
            sessionClass
        );
    }
}
