package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.CsvParser;
import com.smarterd.utils.ExcelUtils;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.springframework.context.MessageSource;
import org.springframework.web.multipart.MultipartFile;

/**
 * 일괄 업로드 서비스의 공통 로직을 담는 추상 클래스.
 *
 * <p>파일 파싱, 팀 접근 검증, i18n 메시지 헬퍼 등 도메인/용어 벌크 서비스에서 공유하는 로직을 제공한다.
 * 서브클래스는 엑셀 행 매핑과 CSV 필드 매핑만 구현하면 된다.</p>
 *
 * @param <R> 엑셀 업로드용 POJO 행 타입
 */
public abstract class AbstractBulkService<R> {

    protected static final int MAX_ROWS = 500;
    protected static final int LOGICAL_NAME_MAX = 100;
    protected static final int DESCRIPTION_MAX = 500;

    private final AuthService authService;
    private final TeamService teamService;
    private final MessageSource messageSource;

    /**
     * @param authService    인증 서비스
     * @param teamService    팀 서비스
     * @param messageSource  메시지 소스
     */
    protected AbstractBulkService(AuthService authService, TeamService teamService, MessageSource messageSource) {
        this.authService = authService;
        this.teamService = teamService;
        this.messageSource = messageSource;
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
     * 팀 접근 권한을 검증하고 팀 엔티티를 반환한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @return 검증된 팀 엔티티
     */
    protected Team verifyTeamAccess(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        return team;
    }

    /**
     * 업로드 파일을 파싱하여 행별 Map 목록을 반환한다.
     *
     * @param file     업로드 파일
     * @param fileName 원본 파일명
     * @return 행별 데이터 Map 목록
     */
    protected List<Map<String, String>> parseFile(MultipartFile file, String fileName) {
        if (fileName == null || (!fileName.endsWith(".xlsx") && !fileName.endsWith(".csv"))) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
        return fileName.endsWith(".xlsx") ? parseExcel(file) : parseCsv(file);
    }

    /**
     * 엑셀 파일을 파싱한다.
     *
     * @param file 엑셀 파일
     * @return 행별 데이터 Map 목록
     */
    protected List<Map<String, String>> parseExcel(MultipartFile file) {
        try (final var excelUtils = new ExcelUtils<R>(file)) {
            final var extract = excelUtils
                .legacyNumericToString(true)
                .strictNumber(false)
                .extractData(uploadRowClass(), 1);
            return extract.getDataList().stream().map(this::mapUploadRow).toList();
        } catch (IOException | InvalidFormatException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
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
            return rows.stream().map(this::mapCsvFields).toList();
        } catch (IOException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
    }

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
    @SuppressWarnings("null")
    protected String msg(String code, Locale locale, Object... args) {
        return messageSource.getMessage(code, args, locale);
    }
}
