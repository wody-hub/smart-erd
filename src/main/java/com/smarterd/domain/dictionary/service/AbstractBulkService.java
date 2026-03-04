package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.api.dictionary.dto.BulkValidationRow;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.CsvParser;
import com.smarterd.utils.ExcelUtils;
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
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.context.MessageSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
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

    private static final String CONSUME_SCRIPT_PATH = "lua/bulk-validation-consume.lua";
    private static final String CONSUME_RESULT_CONSUMED = "__CONSUMED__";
    private static final String CONSUME_RESULT_MISMATCH = "__MISMATCH__";
    private static final DefaultRedisScript<String> CONSUME_SCRIPT = loadScript(CONSUME_SCRIPT_PATH, String.class);

    private final AuthService authService;
    private final TeamService teamService;
    private final MessageSource messageSource;

    /** Redis 문자열 템플릿 */
    protected final StringRedisTemplate redisTemplate;

    /** JSON 직렬화/역직렬화 */
    protected final ObjectMapper objectMapper;

    /**
     * @param authService    인증 서비스
     * @param teamService    팀 서비스
     * @param messageSource  메시지 소스
     * @param redisTemplate  Redis 문자열 템플릿
     * @param objectMapper   JSON 직렬화/역직렬화
     */
    protected AbstractBulkService(
        AuthService authService,
        TeamService teamService,
        MessageSource messageSource,
        StringRedisTemplate redisTemplate,
        ObjectMapper objectMapper
    ) {
        this.authService = authService;
        this.teamService = teamService;
        this.messageSource = messageSource;
        this.redisTemplate = redisTemplate;
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
    protected List<BulkValidationRow> mergePreviewRows(
        List<BulkValidationRow> errorPreviewRows,
        List<BulkValidationRow> validPreviewRows,
        int limit
    ) {
        if (errorPreviewRows.size() >= limit) {
            return List.copyOf(errorPreviewRows);
        }
        final var merged = new ArrayList<BulkValidationRow>(
            Math.min(limit, errorPreviewRows.size() + validPreviewRows.size())
        );
        merged.addAll(errorPreviewRows);
        final var remaining = limit - merged.size();
        if (remaining > 0) {
            merged.addAll(validPreviewRows.stream().limit(remaining).toList());
        }
        merged.sort(Comparator.comparingInt(BulkValidationRow::rowNumber));
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

    // ─────────────────────────────────────────────────────────
    // Redis 검증 세션 관리
    // ─────────────────────────────────────────────────────────

    /**
     * classpath의 Lua 파일을 읽어 {@link DefaultRedisScript} 객체를 생성한다.
     *
     * @param path       classpath 기준 Lua 파일 경로
     * @param resultType 스크립트 반환 타입
     * @param <T>        스크립트 반환 제네릭 타입
     * @return 로드된 Redis Lua 스크립트 객체
     */
    protected static <T> DefaultRedisScript<T> loadScript(String path, Class<T> resultType) {
        final var script = new DefaultRedisScript<T>();
        script.setLocation(new ClassPathResource(Objects.requireNonNull(path)));
        script.setResultType(resultType);
        return script;
    }

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
            final var stored = redisTemplate
                .opsForValue()
                .setIfAbsent(key, payload, Objects.requireNonNull(VALIDATION_SESSION_TTL));
            if (Boolean.TRUE.equals(stored)) {
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
        final var consumeResult = redisTemplate.execute(
            Objects.requireNonNull(CONSUME_SCRIPT),
            Objects.requireNonNull(List.of(validationSessionKey(normalizedToken))),
            loginId,
            String.valueOf(teamId),
            String.valueOf(setId)
        );
        if (consumeResult == null || consumeResult.isEmpty()) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        if (CONSUME_RESULT_CONSUMED.equals(consumeResult) || CONSUME_RESULT_MISMATCH.equals(consumeResult)) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        return parseSessionOrThrow(consumeResult, sessionClass);
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
        final var payload = redisTemplate.opsForValue().get(key);
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        final var session = parseSessionOrThrow(payload, sessionClass);
        if (session instanceof SessionExpirable expirable && expirable.expiresAt().isBefore(Instant.now())) {
            redisTemplate.delete(key);
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

        var rowIdx = 0;

        // 타이틀
        final var titleRow = guideSheet.createRow(rowIdx++);
        final var titleCell = titleRow.createCell(0);
        titleCell.setCellValue(msg("template.guide.title", locale));
        final var font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        final var titleStyle = workbook.createCellStyle();
        titleStyle.setFont(font);
        titleCell.setCellStyle(titleStyle);

        rowIdx++; // 빈 행

        // 안내 항목
        final var prefix = "template.guide." + templateType.key() + ".instruction.";
        for (var i = 1; i <= templateType.instructionCount(); i++) {
            final var row = guideSheet.createRow(rowIdx++);
            final var messageCode = prefix + i;
            final var message = templateType.isMaxRowsInstruction(i)
                ? msg(messageCode, locale, MAX_ROWS)
                : msg(messageCode, locale);
            row.createCell(0).setCellValue(message);
        }

        guideSheet.autoSizeColumn(0);
    }

    /**
     * 템플릿 유형 열거형.
     *
     * <p>메시지 코드 키와 가이드 항목 수를 캡슐화하여 타입 안전성을 보장한다.</p>
     */
    protected enum TemplateType {
        /** 도메인 템플릿 */
        DOMAIN("domain", 7, 7),

        /** 용어 템플릿 */
        TERM("term", 8, 8);

        private final String key;
        private final int instructionCount;
        private final int maxRowsInstructionIndex;

        TemplateType(String key, int instructionCount, int maxRowsInstructionIndex) {
            this.key = key;
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
