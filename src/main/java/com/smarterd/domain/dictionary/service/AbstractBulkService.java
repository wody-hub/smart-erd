package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.CsvParser;
import com.smarterd.utils.ExcelUtils;
import com.smarterd.utils.excel.ExcelData;
import com.smarterd.utils.excel.ExcelSheet;
import java.io.IOException;
import java.lang.reflect.Method;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.context.MessageSource;
import org.springframework.web.multipart.MultipartFile;

/**
 * 일괄 업로드 서비스의 공통 로직을 담는 추상 클래스.
 *
 * <p>파일 파싱, 팀 접근 검증, i18n 메시지 헬퍼, Redis 검증 세션 관리 등
 * 도메인/용어 벌크 서비스에서 공유하는 로직을 제공한다.
 * 서브클래스는 엑셀 행 매핑과 CSV 필드 매핑만 구현하면 된다.</p>
 *
 * @param <R> 엑셀 업로드용 POJO 행 타입
 */
public abstract class AbstractBulkService<R> {

    protected static final int MAX_ROWS = 100_000;
    protected static final int LOGICAL_NAME_MAX = 100;
    protected static final int DESCRIPTION_MAX = 500;

    /** 토큰 발급 최대 재시도 횟수 (UUID 충돌 방어) */
    protected static final int MAX_TOKEN_ISSUE_ATTEMPTS = 3;

    /** 검증 세션 TTL */
    protected static final Duration VALIDATION_SESSION_TTL = Duration.ofMinutes(10);

    private final AuthService authService;
    private final TeamService teamService;
    private final MessageSource messageSource;
    private final BulkValidationSessionStore validationSessionStore;

    /** JSON 직렬화/역직렬화 */
    protected final ObjectMapper objectMapper;

    /**
     * @param authService    인증 서비스
     * @param teamService    팀 서비스
     * @param messageSource  메시지 소스
     * @param validationSessionStore 벌크 검증 세션 저장소
     * @param objectMapper   JSON 직렬화/역직렬화
     */
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
        this.validationSessionStore = validationSessionStore;
        this.objectMapper = objectMapper;
    }

    /**
     * 엑셀 업로드 행 POJO 클래스를 반환한다.
     *
     * @return 엑셀 업로드 행 클래스
     */
    protected abstract Class<R> uploadRowClass();

    /**
     * 엑셀 업로드 행을 필드 이름 → 값 맵으로 변환한다.
     *
     * @param row 엑셀 업로드 행
     * @return 필드 맵
     */
    protected abstract Map<String, String> mapUploadRow(R row);

    /**
     * CSV 필드 배열을 필드 이름 → 값 맵으로 변환한다.
     *
     * @param fields CSV 필드 배열
     * @return 필드 맵
     */
    protected abstract Map<String, String> mapCsvFields(String[] fields);

    /**
     * 검증 세션 Redis 키의 접두사를 반환한다.
     *
     * @return Redis 키 접두사 (예: {@code "dict:bulk:validation:domain:"})
     */
    protected abstract String validationSessionKeyPrefix();

    /**
     * 엑셀 컬럼 키 순서를 반환한다.
     *
     * <p>값을 반환하면 해당 순서로 setter를 고정하여 엑셀 컬럼 순서와 DTO 매핑을 일치시킨다.
     * 기본값은 빈 리스트이며, 이 경우 기존 setter 이름 정렬 규칙을 사용한다.</p>
     *
     * @return 엑셀 컬럼 키 순서
     */
    protected List<String> excelColumnKeys() {
        return List.of();
    }

    /**
     * 팀 접근 권한을 검증하고 팀 엔티티를 반환한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @return 검증된 팀 엔티티
     */
    protected Team verifyTeamAccess(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        return team;
    }

    // ─────────────────────────────────────────────────────────
    // 파일 파싱
    // ─────────────────────────────────────────────────────────

    /**
     * 업로드 파일을 파싱하여 행별 Map 목록을 반환한다.
     *
     * @param file     업로드 파일
     * @param fileName 원본 파일명
     * @return 행별 데이터 Map 목록
     */
    protected List<Map<String, String>> parseFile(MultipartFile file, String fileName) {
        final var normalizedFileName = AppStringUtils.trimToNull(fileName);
        if (!AppStringUtils.endsWithAnyIgnoreCase(normalizedFileName, ".xlsx", ".csv")) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
        return AppStringUtils.endsWithIgnoreCase(normalizedFileName, ".xlsx") ? parseExcel(file) : parseCsv(file);
    }

    /**
     * 엑셀 파일을 파싱한다.
     *
     * @param file 엑셀 파일
     * @return 행별 데이터 Map 목록
     */
    protected List<Map<String, String>> parseExcel(MultipartFile file) {
        final var orderedSetters = resolveOrderedSetters(uploadRowClass(), excelColumnKeys());
        try (
            final var excelUtils = orderedSetters.isEmpty()
                ? new ExcelUtils<R>(file)
                : new ExcelUtils<R>(file, orderedSetters)
        ) {
            final var extract = excelUtils
                .legacyNumericToString(true)
                .strictNumber(false)
                .extractData(uploadRowClass(), 1);
            return extract.getDataList().stream().map(this::mapUploadRow).filter(this::hasAnyValue).toList();
        } catch (IOException | InvalidFormatException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
    }

    /**
     * 엑셀 컬럼 키 순서에 대응하는 setter 목록을 생성한다.
     *
     * @param rowClass  업로드 행 클래스
     * @param fieldKeys 필드 키 순서
     * @return 순서가 고정된 setter 목록
     */
    private List<Method> resolveOrderedSetters(Class<R> rowClass, List<String> fieldKeys) {
        if (fieldKeys == null || fieldKeys.isEmpty()) {
            return List.of();
        }
        final var methods = rowClass.getMethods();
        final var ordered = new ArrayList<Method>(fieldKeys.size());
        for (final var fieldKey : fieldKeys) {
            final var normalized = AppStringUtils.trimToNull(fieldKey);
            if (normalized == null) {
                throw new IllegalStateException("excelColumnKeys must not contain blank values");
            }
            final var setterName = "set" + Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
            final var setter = Arrays.stream(methods)
                .filter((method) -> method.getName().equals(setterName))
                .filter((method) -> method.getParameterCount() == 1)
                .findFirst()
                .orElseThrow(() ->
                    new IllegalStateException("No setter method found for excel column key: " + normalized)
                );
            ordered.add(setter);
        }
        return List.copyOf(ordered);
    }

    /**
     * CSV 파일을 파싱한다.
     *
     * @param file CSV 파일
     * @return 행별 데이터 Map 목록
     */
    protected List<Map<String, String>> parseCsv(MultipartFile file) {
        try {
            final var rows = CsvParser.parse(file.getInputStream());
            return rows.stream().map(this::mapCsvFields).filter(this::hasAnyValue).toList();
        } catch (IOException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
    }

    /**
     * 행 데이터에 하나 이상의 유효 값이 포함되어 있는지 확인한다.
     *
     * @param row 필드 맵
     * @return 하나라도 비어있지 않은 값이 있으면 true
     */
    private boolean hasAnyValue(Map<String, String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        return row.values().stream().anyMatch(AppStringUtils::isNotBlank);
    }

    // ─────────────────────────────────────────────────────────
    // 프리뷰 행 병합
    // ─────────────────────────────────────────────────────────

    /**
     * 에러 프리뷰 행과 유효 프리뷰 행을 병합하여 제한된 수의 프리뷰 목록을 생성한다.
     *
     * <p>에러 행이 {@code limit} 이상이면 에러 행만 반환한다.
     * 그렇지 않으면 에러 행 + 남은 슬롯만큼 유효 행을 채운 뒤 행 번호 순으로 정렬한다.</p>
     *
     * @param errorPreviewRows 에러 프리뷰 행 목록
     * @param validPreviewRows 유효 프리뷰 행 목록
     * @param limit            프리뷰 최대 행 수
     * @return 병합된 프리뷰 행 목록 (불변)
     */
    protected List<BulkValidationRowResult> mergePreviewRows(
        List<BulkValidationRowResult> errorPreviewRows,
        List<BulkValidationRowResult> validPreviewRows,
        int limit
    ) {
        if (errorPreviewRows.size() >= limit) {
            return List.copyOf(errorPreviewRows);
        }
        final var merged = new ArrayList<BulkValidationRowResult>(
            Math.min(limit, errorPreviewRows.size() + validPreviewRows.size())
        );
        merged.addAll(errorPreviewRows);
        final var remaining = limit - merged.size();
        if (remaining > 0) {
            merged.addAll(validPreviewRows.stream().limit(remaining).toList());
        }
        merged.sort(Comparator.comparingInt(BulkValidationRowResult::rowNumber));
        return List.copyOf(merged);
    }

    // ─────────────────────────────────────────────────────────
    // 유틸리티 헬퍼
    // ─────────────────────────────────────────────────────────

    /**
     * null을 빈 문자열로 변환한다.
     *
     * @param value 문자열 (nullable)
     * @return 빈 문자열 또는 원본 값
     */
    protected String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * 논리명 목록을 배치 단위로 정규화/조회하여 기존 엔티티를 반환한다.
     *
     * @param logicalNames   조회 대상 논리명 목록
     * @param batchSize      배치 크기
     * @param chunkFetcher   배치 조회 함수
     * @param nameExtractor  엔티티에서 논리명을 추출하는 함수
     * @param <T>            조회 대상 타입
     * @return 논리명 기준 기존 엔티티 맵
     */
    protected <T> Map<String, T> findExistingByLogicalNames(
        List<String> logicalNames,
        int batchSize,
        Function<List<String>, List<T>> chunkFetcher,
        Function<T, String> nameExtractor
    ) {
        final var normalized = logicalNames
            .stream()
            .map(AppStringUtils::trimToEmpty)
            .filter(AppStringUtils::isNotBlank)
            .distinct()
            .toList();
        if (normalized.isEmpty()) {
            return Map.of();
        }

        final var existingByLogicalName = new java.util.LinkedHashMap<String, T>();
        for (var start = 0; start < normalized.size(); start += batchSize) {
            final var end = Math.min(start + batchSize, normalized.size());
            final var chunk = chunkFetcher.apply(normalized.subList(start, end));
            for (final var entity : chunk) {
                existingByLogicalName.putIfAbsent(nameExtractor.apply(entity), entity);
            }
        }
        return Map.copyOf(existingByLogicalName);
    }

    /**
     * 논리명 목록을 배치 조회하여 기존 논리명 집합을 반환한다.
     *
     * @param logicalNames   조회 대상 논리명 목록
     * @param batchSize      배치 크기
     * @param chunkFetcher   배치 조회 함수
     * @param nameExtractor  엔티티에서 논리명을 추출하는 함수
     * @param <T>            조회 대상 타입
     * @return 기존 논리명 집합
     */
    protected <T> java.util.Set<String> findExistingLogicalNames(
        List<String> logicalNames,
        int batchSize,
        Function<List<String>, List<T>> chunkFetcher,
        Function<T, String> nameExtractor
    ) {
        return findExistingByLogicalNames(logicalNames, batchSize, chunkFetcher, nameExtractor).keySet();
    }

    /**
     * 행 수를 검증한다. 빈 파일이거나 최대 행 수를 초과하면 예외를 발생시킨다.
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
     * @param code   메시지 코드
     * @param locale 로케일
     * @param args   메시지 인자
     * @return 해석된 메시지 문자열
     */
    protected String msg(String code, Locale locale, Object... args) {
        final var nonNullCode = Objects.requireNonNull(code, "code must not be null");
        final var nonNullLocale = Objects.requireNonNull(locale, "locale must not be null");
        return messageSource.getMessage(nonNullCode, args, nonNullLocale);
    }

    /**
     * 오류 리포트용 record accessor 메서드 목록을 해석한다.
     *
     * @param rowClass      오류 리포트 행 클래스
     * @param methodNames   메서드 이름 순서
     * @param errorMessage  해석 실패 시 예외 메시지
     * @return accessor 메서드 목록
     * @param <T>           오류 리포트 행 타입
     */
    protected <T> List<Method> resolveAccessorMethods(Class<T> rowClass, List<String> methodNames, String errorMessage) {
        try {
            final var methods = new ArrayList<Method>(methodNames.size());
            for (final var methodName : methodNames) {
                methods.add(rowClass.getMethod(methodName));
            }
            return List.copyOf(methods);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(errorMessage, e);
        }
    }

    /**
     * 단일 시트 오류 리포트 엑셀을 생성한다.
     *
     * @param rows            오류 행 목록
     * @param rowClass        오류 행 타입
     * @param filePrefix      파일명 prefix
     * @param locale          로케일
     * @param titleCodes      컬럼 제목 메시지 코드
     * @param accessorNames   record accessor 이름 순서
     * @param accessorError   accessor 해석 실패 메시지
     * @return 엑셀 데이터
     * @param <T>             오류 행 타입
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
        final var sheet = new ExcelSheet<T>();
        sheet.setSheetName(msg("bulk.error-report.sheet-name", locale));
        sheet.setTitles(titleCodes.stream().map((code) -> msg(code, locale)).toList());
        sheet.setReqMethods(resolveAccessorMethods(rowClass, accessorNames, accessorError));
        sheet.setDataList(rows);
        return new ExcelUtils<T>().toExcel(List.of(sheet), null, filePrefix);
    }

    /**
     * 데이터 시트와 가이드 시트를 포함한 템플릿 엑셀을 생성한다.
     *
     * @param locale        로케일
     * @param templateType  템플릿 유형
     * @param sheetNameCode 데이터 시트명 메시지 코드
     * @param titleCodes    컬럼 제목 메시지 코드
     * @param sampleRows    샘플 데이터
     * @return 엑셀 데이터
     * @param <T>           템플릿 행 타입
     */
    protected <T> ExcelData buildTemplateExcel(
        Locale locale,
        TemplateType templateType,
        String sheetNameCode,
        List<String> titleCodes,
        List<T> sampleRows
    ) {
        final var titles = titleCodes.stream().map((code) -> msg(code, locale)).toList();
        try (final var utils = new ExcelUtils<>(sampleRows, titles)) {
            utils.sheetName(msg(sheetNameCode, locale));
            final var excelData = utils.toExcel();
            styleTemplateDataSheet(excelData.excelBook().getSheetAt(0));
            addGuideSheet(excelData.excelBook(), locale, templateType);
            excelData.excelBook().setActiveSheet(0);
            excelData.excelBook().setSelectedTab(0);
            return excelData;
        } catch (IOException e) {
            throw new java.io.UncheckedIOException("Failed to release Excel template resources", e);
        }
    }

    // ─────────────────────────────────────────────────────────
    // 검증 세션 관리
    // ─────────────────────────────────────────────────────────

    /**
     * 검증 세션 Redis 키를 생성한다.
     *
     * @param token 검증 토큰
     * @return Redis 키
     */
    protected String validationSessionKey(String token) {
        return validationSessionKeyPrefix() + token;
    }

    /**
     * 검증 토큰을 정규화한다.
     *
     * @param token 원본 토큰 문자열
     * @return 정규화된 토큰
     * @throws BusinessException 토큰이 null이거나 빈 문자열인 경우
     */
    protected String normalizeValidationToken(String token) {
        final var normalizedToken = AppStringUtils.trimToNull(token);
        if (normalizedToken == null) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        return normalizedToken;
    }

    /**
     * 세션 객체를 Redis에 저장하고 고유 토큰을 발급한다.
     *
     * <p>UUID 충돌 시 최대 {@value #MAX_TOKEN_ISSUE_ATTEMPTS}회 재시도한다.</p>
     *
     * @param session 직렬화할 세션 객체
     * @return 발급된 토큰 문자열
     * @throws BusinessException 재시도 횟수 초과 시
     */
    protected String issueValidationToken(Object session) {
        for (var attempt = 0; attempt < MAX_TOKEN_ISSUE_ATTEMPTS; attempt++) {
            final var token = UUID.randomUUID().toString();
            final var key = Objects.requireNonNull(validationSessionKey(token));
            final var payload = Objects.requireNonNull(serializeSession(session));
            final var stored = validationSessionStore.putIfAbsent(
                key,
                payload,
                Objects.requireNonNull(VALIDATION_SESSION_TTL)
            );
            if (stored) {
                return token;
            }
        }
        throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_ISSUE_FAILED.code());
    }

    /**
     * 검증 토큰을 소비하여 세션을 반환한다.
     *
     * <p>세션은 단일 사용이며 성공적으로 검증되면 즉시 소비 처리된다.</p>
     *
     * @param loginId      요청 사용자 로그인 ID
     * @param teamId       팀 ID
     * @param setId        사전 세트 ID
     * @param token        검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S>          세션 타입
     * @return 검증 세션 객체
     * @throws BusinessException 토큰이 유효하지 않거나 이미 소비된 경우
     */
    protected <S> S consumeValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        final var normalizedToken = normalizeValidationToken(token);
        final var consumeResult = validationSessionStore.consume(
            validationSessionKey(normalizedToken),
            loginId,
            teamId,
            setId
        );
        if (consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.MISSING) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        if (
            consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.ALREADY_CONSUMED ||
            consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.OWNERSHIP_MISMATCH
        ) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        return parseSessionOrThrow(Objects.requireNonNull(consumeResult.payload()), sessionClass);
    }

    /**
     * 검증 토큰으로 세션을 조회한다. (읽기 전용)
     *
     * @param loginId      요청 사용자 로그인 ID
     * @param teamId       팀 ID
     * @param setId        사전 세트 ID
     * @param token        검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S>          세션 타입
     * @return 검증 세션 객체
     * @throws BusinessException 토큰이 유효하지 않거나 만료된 경우
     */
    protected <S> S resolveValidationSession(
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        final var normalizedToken = normalizeValidationToken(token);
        final var key = Objects.requireNonNull(validationSessionKey(normalizedToken));
        final var payload = validationSessionStore.get(key);
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        final var session = parseSessionOrThrow(payload, sessionClass);
        if (session instanceof SessionExpirable expirable && expirable.expiresAt().isBefore(Instant.now())) {
            validationSessionStore.delete(key);
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        if (session instanceof SessionOwnership ownership) {
            if (
                !ownership.loginId().equals(loginId) ||
                !ownership.teamId().equals(teamId) ||
                !ownership.setId().equals(setId)
            ) {
                throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
            }
        }
        return session;
    }

    /**
     * 세션 객체를 JSON으로 직렬화한다.
     *
     * @param session 세션 객체
     * @return JSON 문자열
     */
    protected String serializeSession(Object session) {
        try {
            return objectMapper.writeValueAsString(session);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize bulk validation session", e);
        }
    }

    /**
     * JSON에서 세션 객체를 역직렬화한다.
     *
     * @param payload      JSON 문자열
     * @param sessionClass 대상 클래스
     * @param <S>          세션 타입
     * @return 역직렬화된 세션 객체
     * @throws BusinessException 파싱 실패 시
     */
    protected <S> S parseSessionOrThrow(String payload, Class<S> sessionClass) {
        try {
            return objectMapper.readValue(payload, sessionClass);
        } catch (JsonProcessingException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
    }

    // ─────────────────────────────────────────────────────────
    // 세션 검증용 인터페이스
    // ─────────────────────────────────────────────────────────

    /**
     * 만료 시각을 가지는 세션 인터페이스.
     */
    protected interface SessionExpirable {
        /** @return 만료 시각 */
        Instant expiresAt();
    }

    /**
     * 소유자 정보를 가지는 세션 인터페이스.
     */
    protected interface SessionOwnership {
        /** @return 사용자 로그인 ID */
        String loginId();

        /** @return 팀 ID */
        Long teamId();

        /** @return 사전 세트 ID */
        Long setId();
    }

    // ─────────────────────────────────────────────────────────
    // 엑셀 가이드 시트
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 워크북에 가이드 시트를 추가한다.
     *
     * <p>템플릿 엑셀 다운로드 시 데이터 시트 옆에 사용 안내 시트를 생성한다.
     * 가이드 내용은 {@code template.guide.*} 메시지 코드에서 로케일에 맞게 해석된다.</p>
     *
     * @param workbook     대상 워크북
     * @param locale       로케일
     * @param templateType 템플릿 유형
     */
    protected void addGuideSheet(Workbook workbook, Locale locale, TemplateType templateType) {
        final var sheetName = msg("template.guide.sheet-name", locale);
        final var guideSheet = workbook.createSheet(sheetName);
        guideSheet.setDisplayGridlines(false);
        guideSheet.setColumnWidth(0, 18 * 256);
        guideSheet.setColumnWidth(1, 20 * 256);
        guideSheet.setColumnWidth(2, 18 * 256);
        guideSheet.setColumnWidth(3, 44 * 256);

        var rowIdx = 0;

        final var heroTitleStyle = createGuideHeroTitleStyle(workbook);
        final var heroSubtitleStyle = createGuideHeroSubtitleStyle(workbook);
        final var sectionStyle = createGuideSectionStyle(workbook);
        final var labelStyle = createGuideLabelStyle(workbook);
        final var valueStyle = createGuideValueStyle(workbook);
        final var bulletIndexStyle = createGuideBulletIndexStyle(workbook);
        final var bulletTextStyle = createGuideBulletTextStyle(workbook);

        // 타이틀 배너
        guideSheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));
        final var titleRow = guideSheet.createRow(rowIdx++);
        titleRow.setHeightInPoints(24);
        final var titleCell = titleRow.createCell(0);
        titleCell.setCellValue(msg("template.guide.title", locale));
        titleCell.setCellStyle(heroTitleStyle);
        applyMergedRegionStyle(guideSheet, 0, 0, 0, 3, heroTitleStyle);

        guideSheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 3));
        final var subtitleRow = guideSheet.createRow(rowIdx++);
        subtitleRow.setHeightInPoints(20);
        final var subtitleCell = subtitleRow.createCell(0);
        subtitleCell.setCellValue(msg("template.guide.subtitle", locale));
        subtitleCell.setCellStyle(heroSubtitleStyle);
        applyMergedRegionStyle(guideSheet, 1, 1, 0, 3, heroSubtitleStyle);

        rowIdx++;

        final var summaryTitleRow = guideSheet.createRow(rowIdx++);
        summaryTitleRow.createCell(0).setCellValue(msg("template.guide.summary.title", locale));
        summaryTitleRow.getCell(0).setCellStyle(sectionStyle);
        applyMergedRegionStyle(guideSheet, summaryTitleRow.getRowNum(), summaryTitleRow.getRowNum(), 0, 3, sectionStyle);
        guideSheet.addMergedRegion(
            new CellRangeAddress(summaryTitleRow.getRowNum(), summaryTitleRow.getRowNum(), 0, 3)
        );

        rowIdx = createGuideSummaryRow(
            guideSheet,
            rowIdx,
            msg("template.guide.summary.sheet", locale),
            msg(templateType.sheetNameCode(), locale),
            labelStyle,
            valueStyle
        );
        rowIdx = createGuideSummaryRow(
            guideSheet,
            rowIdx,
            msg("template.guide.summary.formats", locale),
            ".xlsx, .csv",
            labelStyle,
            valueStyle
        );
        rowIdx = createGuideSummaryRow(
            guideSheet,
            rowIdx,
            msg("template.guide.summary.max-rows", locale),
            String.valueOf(MAX_ROWS),
            labelStyle,
            valueStyle
        );

        rowIdx++;

        final var instructionTitleRow = guideSheet.createRow(rowIdx++);
        instructionTitleRow.createCell(0).setCellValue(msg("template.guide.instructions.title", locale));
        instructionTitleRow.getCell(0).setCellStyle(sectionStyle);
        applyMergedRegionStyle(guideSheet, instructionTitleRow.getRowNum(), instructionTitleRow.getRowNum(), 0, 3, sectionStyle);
        guideSheet.addMergedRegion(
            new CellRangeAddress(instructionTitleRow.getRowNum(), instructionTitleRow.getRowNum(), 0, 3)
        );

        // 안내 항목
        final var prefix = "template.guide." + templateType.key() + ".instruction.";
        for (var i = 1; i <= templateType.instructionCount(); i++) {
            final var row = guideSheet.createRow(rowIdx++);
            row.setHeightInPoints(22);
            final var messageCode = prefix + i;
            final var message = templateType.isMaxRowsInstruction(i)
                ? msg(messageCode, locale, MAX_ROWS)
                : msg(messageCode, locale);
            final var indexCell = row.createCell(0);
            indexCell.setCellValue(i);
            indexCell.setCellStyle(bulletIndexStyle);

            final var messageCell = row.createCell(1);
            messageCell.setCellValue(stripInstructionNumber(message));
            messageCell.setCellStyle(bulletTextStyle);
            applyMergedRegionStyle(row, 1, 3, bulletTextStyle);
            guideSheet.addMergedRegion(new CellRangeAddress(row.getRowNum(), row.getRowNum(), 1, 3));
        }
    }

    /**
     * 템플릿 데이터 시트에 헤더/예시행 스타일과 필터를 적용한다.
     *
     * @param dataSheet 스타일을 적용할 데이터 시트
     */
    private void styleTemplateDataSheet(Sheet dataSheet) {
        if (dataSheet == null) {
            return;
        }

        dataSheet.setDisplayGridlines(false);
        dataSheet.createFreezePane(0, 1);
        dataSheet.setZoom(120);

        final var workbook = dataSheet.getWorkbook();
        final var headerRequiredStyle = createTemplateHeaderStyle(workbook, true);
        final var headerOptionalStyle = createTemplateHeaderStyle(workbook, false);
        final var sampleStyle = createTemplateSampleStyle(workbook);

        final var headerRow = dataSheet.getRow(0);
        if (headerRow == null || headerRow.getLastCellNum() < 0) {
            return;
        }

        headerRow.setHeightInPoints(24);
        final var lastColumnIndex = headerRow.getLastCellNum() - 1;
        for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
            final var headerCell = headerRow.getCell(columnIndex);
            if (headerCell == null) {
                continue;
            }
            final var headerValue = AppStringUtils.trimToEmpty(headerCell.getStringCellValue());
            headerCell.setCellStyle(isRequiredHeader(headerValue) ? headerRequiredStyle : headerOptionalStyle);
        }

        for (var rowIndex = 1; rowIndex <= dataSheet.getLastRowNum(); rowIndex++) {
            final var row = dataSheet.getRow(rowIndex);
            if (row == null) {
                continue;
            }
            row.setHeightInPoints(21);
            for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
                final var cell = row.getCell(columnIndex);
                if (cell == null) {
                    continue;
                }
                cell.setCellStyle(sampleStyle);
            }
        }

        dataSheet.setAutoFilter(new CellRangeAddress(0, 0, 0, lastColumnIndex));
        for (var columnIndex = 0; columnIndex <= lastColumnIndex; columnIndex++) {
            dataSheet.autoSizeColumn(columnIndex);
            final var currentWidth = dataSheet.getColumnWidth(columnIndex);
            dataSheet.setColumnWidth(columnIndex, Math.min(currentWidth + 1024, 48 * 256));
        }
    }

    /**
     * 헤더 라벨이 필수 입력 컬럼인지 판별한다.
     *
     * @param headerValue 헤더 문자열
     * @return 필수 컬럼 헤더이면 {@code true}
     */
    private boolean isRequiredHeader(String headerValue) {
        return headerValue.contains("필수") || AppStringUtils.containsIgnoreCase(headerValue, "required");
    }

    /**
     * 가이드 시트의 요약 행 하나를 생성한다.
     *
     * @param guideSheet 가이드 시트
     * @param rowIndex 생성할 행 인덱스
     * @param label 요약 항목 라벨
     * @param value 요약 항목 값
     * @param labelStyle 라벨 셀 스타일
     * @param valueStyle 값 셀 스타일
     * @return 다음에 사용할 행 인덱스
     */
    private int createGuideSummaryRow(
        Sheet guideSheet,
        int rowIndex,
        String label,
        String value,
        org.apache.poi.ss.usermodel.CellStyle labelStyle,
        org.apache.poi.ss.usermodel.CellStyle valueStyle
    ) {
        final var row = guideSheet.createRow(rowIndex);
        final var labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);

        final var valueCell = row.createCell(1);
        valueCell.setCellValue(value);
        valueCell.setCellStyle(valueStyle);
        applyMergedRegionStyle(row, 1, 3, valueStyle);
        guideSheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 1, 3));
        return rowIndex + 1;
    }

    /**
     * 병합 영역 전체에 동일한 셀 스타일을 적용한다.
     *
     * @param sheet 대상 시트
     * @param firstRow 시작 행
     * @param lastRow 종료 행
     * @param firstColumn 시작 열
     * @param lastColumn 종료 열
     * @param style 적용할 셀 스타일
     */
    private void applyMergedRegionStyle(
        Sheet sheet,
        int firstRow,
        int lastRow,
        int firstColumn,
        int lastColumn,
        org.apache.poi.ss.usermodel.CellStyle style
    ) {
        for (var rowIndex = firstRow; rowIndex <= lastRow; rowIndex++) {
            final var row = sheet.getRow(rowIndex) == null ? sheet.createRow(rowIndex) : sheet.getRow(rowIndex);
            applyMergedRegionStyle(row, firstColumn, lastColumn, style);
        }
    }

    /**
     * 단일 행의 지정 열 범위에 동일한 셀 스타일을 적용한다.
     *
     * @param row 대상 행
     * @param firstColumn 시작 열
     * @param lastColumn 종료 열
     * @param style 적용할 셀 스타일
     */
    private void applyMergedRegionStyle(Row row, int firstColumn, int lastColumn, org.apache.poi.ss.usermodel.CellStyle style) {
        for (var columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex++) {
            final var cell = row.getCell(columnIndex) == null ? row.createCell(columnIndex) : row.getCell(columnIndex);
            cell.setCellStyle(style);
        }
    }

    /**
     * 안내 메시지 앞의 번호 접두사({@code "1. "})를 제거한다.
     *
     * @param message 원본 안내 메시지
     * @return 번호 접두사가 제거된 문자열
     */
    private String stripInstructionNumber(String message) {
        final var normalizedMessage = AppStringUtils.trimToEmpty(message);
        final var separatorIndex = normalizedMessage.indexOf(". ");
        if (separatorIndex < 0) {
            return normalizedMessage;
        }
        return normalizedMessage.substring(separatorIndex + 2);
    }

    /**
     * 템플릿 헤더 셀 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @param required 필수 컬럼 여부
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createTemplateHeaderStyle(Workbook workbook, boolean required) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(required ? IndexedColors.DARK_BLUE.getIndex() : IndexedColors.BLUE_GREY.getIndex());
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.MEDIUM);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);

        final var font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        return style;
    }

    /**
     * 템플릿 예시 데이터 행 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createTemplateSampleStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        final var font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트의 hero 제목 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideHeroTitleStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        final var font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        font.setFontHeightInPoints((short) 16);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트의 hero 부제목 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideHeroSubtitleStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        final var font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.GREY_80_PERCENT.getIndex());
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트의 섹션 제목 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideSectionStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        final var font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트의 요약 라벨 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideLabelStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        final var font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트의 요약 값 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideValueStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setWrapText(true);
        final var font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트 안내 목록의 번호 셀 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideBulletIndexStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        final var font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    /**
     * 가이드 시트 안내 목록의 본문 셀 스타일을 생성한다.
     *
     * @param workbook 대상 워크북
     * @return 생성된 셀 스타일
     */
    private org.apache.poi.ss.usermodel.CellStyle createGuideBulletTextStyle(Workbook workbook) {
        final var style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(true);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        final var font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    /**
     * 템플릿 유형 열거형.
     *
     * <p>메시지 코드 키와 가이드 항목 수를 캡슐화하여 타입 안전성을 보장한다.</p>
     */
    protected enum TemplateType {
        /** 도메인 템플릿 */
        DOMAIN("domain", "template.domain.sheet-name", 7, 7),

        /** 용어 템플릿 */
        TERM("term", "template.term.sheet-name", 8, 8),

        /** 단어 템플릿 */
        WORD("word", "template.word.sheet-name", 7, 7);

        private final String key;
        private final String sheetNameCode;
        private final int instructionCount;
        private final int maxRowsInstructionIndex;

        TemplateType(String key, String sheetNameCode, int instructionCount, int maxRowsInstructionIndex) {
            this.key = key;
            this.sheetNameCode = sheetNameCode;
            this.instructionCount = instructionCount;
            this.maxRowsInstructionIndex = maxRowsInstructionIndex;
        }

        /**
         * @return 메시지 코드에 사용되는 키 (예: {@code "domain"}, {@code "term"})
         */
        public String key() {
            return key;
        }

        /**
         * @return 데이터 시트명 메시지 코드
         */
        public String sheetNameCode() {
            return sheetNameCode;
        }

        /**
         * @return 가이드 시트의 안내 항목 수
         */
        public int instructionCount() {
            return instructionCount;
        }

        /**
         * @param instructionIndex 안내 항목 번호 (1-based)
         * @return 업로드 최대 행 수 안내 항목이면 true
         */
        public boolean isMaxRowsInstruction(int instructionIndex) {
            return instructionIndex == maxRowsInstructionIndex;
        }
    }
}
