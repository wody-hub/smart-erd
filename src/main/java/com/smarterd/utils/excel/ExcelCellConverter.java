package com.smarterd.utils.excel;

import com.smarterd.utils.AppStringUtils;
import java.io.Serial;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.IntFunction;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.NumberToTextConverter;
import org.springframework.lang.Nullable;

/**
 * 엑셀 셀 타입 변환을 담당하는 유틸리티 클래스.
 *
 * <p>셀 값 읽기(문자열, 숫자, 날짜), setter를 통한 데이터 세팅,
 * 셀에 데이터 쓰기 등 타입 변환 로직을 캡슐화한다.</p>
 */
@Slf4j
public class ExcelCellConverter {

    private static final String DEFAULT_DATE_CELL_FORMAT = "yyyy-mm-dd";
    private static final String DEFAULT_DATE_TIME_CELL_FORMAT = "yyyy-mm-dd hh:mm:ss";

    private final DataFormatter dataFormatter = new DataFormatter(Locale.KOREA);
    private final Map<String, CellStyle> dateStyleCache = new HashMap<>();
    private final Map<String, CellStyle> numberStyleCache = new HashMap<>();

    private FormulaEvaluator formulaEvaluator;
    private List<String> inputDateFormats = new ArrayList<>();
    private ZoneId zoneId = ZoneId.systemDefault();
    private boolean strictNumber = false;
    private boolean legacyNumericToString = true;
    private String defaultDateFormat = "yyyy-MM-dd'T'HH:mm:ss";

    /**
     * 수식 평가기를 설정한다.
     *
     * @param formulaEvaluator 수식 평가기
     */
    public void setFormulaEvaluator(FormulaEvaluator formulaEvaluator) {
        this.formulaEvaluator = formulaEvaluator;
    }

    /**
     * 문자열 날짜 파싱을 위한 추가 포맷 목록을 설정한다.
     *
     * @param formats 날짜 포맷 목록
     */
    public void setInputDateFormats(List<String> formats) {
        this.inputDateFormats = (formats == null) ? new ArrayList<>() : new ArrayList<>(formats);
    }

    /**
     * 날짜 변환 시 사용할 기본 ZoneId를 설정한다.
     *
     * @param zoneId ZoneId
     */
    public void setZoneId(ZoneId zoneId) {
        if (zoneId != null) {
            this.zoneId = zoneId;
        }
    }

    /**
     * 숫자 변환 시 정밀 변환 모드(소수/범위 오류 시 예외)를 설정한다.
     *
     * @param strictNumber strict 모드 여부
     */
    public void setStrictNumber(boolean strictNumber) {
        this.strictNumber = strictNumber;
    }

    /**
     * 숫자 셀을 String으로 읽을 때 기존 동작(정수 캐스팅)을 유지할지 설정한다.
     *
     * @param legacyNumericToString legacy 모드 여부
     */
    public void setLegacyNumericToString(boolean legacyNumericToString) {
        this.legacyNumericToString = legacyNumericToString;
    }

    /**
     * 기본 날짜 포맷을 반환한다.
     *
     * @return 기본 날짜 포맷 문자열
     */
    public String getDefaultDateFormat() {
        return defaultDateFormat;
    }

    /**
     * 기본 날짜 포맷을 설정한다.
     *
     * @param defaultDateFormat 날짜 포맷 문자열
     */
    public void setDefaultDateFormat(String defaultDateFormat) {
        this.defaultDateFormat = defaultDateFormat;
    }

    // ─────────────────────────────────────────────────────────
    // 셀 읽기 — 업로드(파싱) 시 사용
    // ─────────────────────────────────────────────────────────

    /**
     * 수식 셀 포함 실제 셀 타입을 계산한다.
     *
     * @param cell 셀
     * @return 셀 타입
     */
    public CellType resolveCellType(Cell cell) {
        if (cell == null) {
            return CellType.BLANK;
        }
        if (cell.getCellType() == CellType.FORMULA) {
            if (formulaEvaluator != null) {
                return formulaEvaluator.evaluateFormulaCell(cell);
            }
            return cell.getCachedFormulaResultType();
        }
        return cell.getCellType();
    }

    /**
     * 셀 값을 문자열로 읽는다.
     *
     * @param cell 셀
     * @return 문자열 값
     */
    public String readCellText(Cell cell) {
        if (cell == null) {
            return "";
        }
        final var cellType = resolveCellType(cell);
        if (legacyNumericToString && cellType == CellType.NUMERIC && !DateUtil.isCellDateFormatted(cell)) {
            return String.valueOf((long) cell.getNumericCellValue());
        }
        return dataFormatter.formatCellValue(cell, formulaEvaluator);
    }

    /**
     * 숫자 셀 값을 BigDecimal로 읽는다.
     *
     * @param cell 셀
     * @return 숫자 값 (null 가능)
     */
    @Nullable
    public BigDecimal readNumericCell(Cell cell) {
        if (cell == null) {
            return null;
        }
        final var cellType = resolveCellType(cell);
        if (cellType == CellType.NUMERIC) {
            final double numericValue;
            if (cell.getCellType() == CellType.FORMULA && formulaEvaluator != null) {
                final var evaluated = formulaEvaluator.evaluate(cell);
                if (evaluated == null) {
                    return null;
                }
                numericValue = evaluated.getNumberValue();
            } else {
                numericValue = cell.getNumericCellValue();
            }
            return new BigDecimal(NumberToTextConverter.toText(numericValue));
        }

        final var text = AppStringUtils.trimToNull(readCellText(cell).replace(",", ""));
        if (text == null) {
            return null;
        }
        return new BigDecimal(text);
    }

    // ─────────────────────────────────────────────────────────
    // setter 호출 — 업로드 시 POJO에 값 세팅
    // ─────────────────────────────────────────────────────────

    /**
     * setter 메서드를 통해 셀 값을 데이터 객체에 세팅한다.
     *
     * @param data   대상 데이터 객체
     * @param method setter 메서드
     * @param cell   엑셀 셀
     * @param <T>    데이터 타입
     */
    public <T> void setData(T data, Method method, Cell cell) {
        final var parameters = method.getParameters();
        if (parameters == null || parameters.length == 0) {
            throw new BadParametersException("Setter parameter is missing; cannot extract data.");
        }

        final var cellType = resolveCellType(cell);
        if (cellType == CellType.BLANK) {
            return;
        }

        final var parameter = parameters[0];
        final var parameterType = parameter.getType();

        // ERROR cell (#NAME?, etc.) is treated as empty for String columns — handled during validation.
        if (cellType == CellType.ERROR && String.class.isAssignableFrom(parameterType)) {
            try {
                method.invoke(data, "");
                return;
            } catch (IllegalAccessException | InvocationTargetException e) {
                if (log.isErrorEnabled()) {
                    log.error(e.getMessage(), e);
                }
                throw new MethodInvokeFailException("Method invocation failed.");
            }
        }

        if (!allowSetParameterType(cellType, parameterType)) {
            if (log.isErrorEnabled()) {
                log.error(
                    "Unsupported parameter type for cell setter - cellType: {}, parameterType: {}, value: {}",
                    cellType,
                    parameterType,
                    cell
                );
            }
            throw new BadParametersException("Unsupported parameter type for cell setter.");
        }

        try {
            invokeSetterByType(data, method, cell, cellType, parameterType);
        } catch (IllegalAccessException | InvocationTargetException e) {
            if (log.isErrorEnabled()) {
                log.error(e.getMessage(), e);
            }
            throw new MethodInvokeFailException("Method invocation failed.");
        }
    }

    /**
     * 파라미터 타입에 맞게 셀 값을 setter로 세팅하는 내부 메서드.
     *
     * @param data          대상 데이터 객체
     * @param method        setter 메서드
     * @param cell          엑셀 셀
     * @param cellType      해석된 셀 타입
     * @param parameterType setter 파라미터 타입
     * @param <T>           데이터 타입
     */
    private <T> void invokeSetterByType(T data, Method method, Cell cell, CellType cellType, Class<?> parameterType)
        throws IllegalAccessException, InvocationTargetException {
        if (String.class.isAssignableFrom(parameterType)) {
            method.invoke(data, readCellText(cell));
            return;
        }

        if (isDateType(parameterType)) {
            setDateValue(data, method, cell, cellType, parameterType);
            return;
        }

        if (isNumericType(parameterType)) {
            setNumericValue(data, method, cell, parameterType);
            return;
        }

        if (parameterType.isEnum()) {
            setEnumValue(data, method, cell, parameterType);
            return;
        }

        if (log.isErrorEnabled()) {
            log.error("Unsupported parameter type for method invocation. parameterType is {}", parameterType);
        }
        throw new MethodInvokeFailException("Unsupported parameter type for method invocation.");
    }

    /**
     * 날짜 타입인지 확인한다.
     *
     * @param type 파라미터 타입
     * @return 날짜 타입 여부
     */
    private boolean isDateType(Class<?> type) {
        return (
            Date.class.isAssignableFrom(type) ||
            LocalDateTime.class.isAssignableFrom(type) ||
            LocalDate.class.isAssignableFrom(type) ||
            Calendar.class.isAssignableFrom(type)
        );
    }

    /**
     * 숫자 타입인지 확인한다.
     *
     * @param type 파라미터 타입
     * @return 숫자 타입 여부
     */
    private boolean isNumericType(Class<?> type) {
        return (
            int.class.isAssignableFrom(type) ||
            Integer.class.isAssignableFrom(type) ||
            short.class.isAssignableFrom(type) ||
            Short.class.isAssignableFrom(type) ||
            byte.class.isAssignableFrom(type) ||
            Byte.class.isAssignableFrom(type) ||
            long.class.isAssignableFrom(type) ||
            Long.class.isAssignableFrom(type) ||
            float.class.isAssignableFrom(type) ||
            Float.class.isAssignableFrom(type) ||
            double.class.isAssignableFrom(type) ||
            Double.class.isAssignableFrom(type)
        );
    }

    /**
     * 날짜 값을 setter로 세팅한다.
     */
    private <T> void setDateValue(T data, Method method, Cell cell, CellType cellType, Class<?> parameterType)
        throws IllegalAccessException, InvocationTargetException {
        if (cellType == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            final var date = cell.getDateCellValue();
            if (Date.class.isAssignableFrom(parameterType)) {
                method.invoke(data, date);
            } else if (LocalDateTime.class.isAssignableFrom(parameterType)) {
                method.invoke(data, date.toInstant().atZone(zoneId).toLocalDateTime());
            } else if (LocalDate.class.isAssignableFrom(parameterType)) {
                method.invoke(data, date.toInstant().atZone(zoneId).toLocalDate());
            } else if (Calendar.class.isAssignableFrom(parameterType)) {
                final var cal = Calendar.getInstance();
                cal.setTime(date);
                method.invoke(data, cal);
            }
            return;
        }

        final var text = AppStringUtils.trimToNull(readCellText(cell));
        if (text == null) {
            return;
        }
        final var dateTime = parseDateTime(text, null);
        if (dateTime == null) {
            throw new MethodInvokeFailException("Failed to parse date. value: " + text);
        }

        if (Date.class.isAssignableFrom(parameterType)) {
            method.invoke(data, Date.from(dateTime.atZone(zoneId).toInstant()));
        } else if (LocalDateTime.class.isAssignableFrom(parameterType)) {
            method.invoke(data, dateTime);
        } else if (LocalDate.class.isAssignableFrom(parameterType)) {
            method.invoke(data, dateTime.toLocalDate());
        } else if (Calendar.class.isAssignableFrom(parameterType)) {
            final var cal = Calendar.getInstance();
            cal.setTime(Date.from(dateTime.atZone(zoneId).toInstant()));
            method.invoke(data, cal);
        }
    }

    /**
     * 숫자 값을 setter로 세팅한다.
     */
    private <T> void setNumericValue(T data, Method method, Cell cell, Class<?> parameterType)
        throws IllegalAccessException, InvocationTargetException {
        final var value = readNumericCell(cell);
        if (value == null) {
            return;
        }
        if (int.class.isAssignableFrom(parameterType) || Integer.class.isAssignableFrom(parameterType)) {
            method.invoke(data, strictNumber ? value.intValueExact() : value.intValue());
        } else if (short.class.isAssignableFrom(parameterType) || Short.class.isAssignableFrom(parameterType)) {
            method.invoke(data, strictNumber ? value.shortValueExact() : value.shortValue());
        } else if (byte.class.isAssignableFrom(parameterType) || Byte.class.isAssignableFrom(parameterType)) {
            method.invoke(data, strictNumber ? value.byteValueExact() : value.byteValue());
        } else if (long.class.isAssignableFrom(parameterType) || Long.class.isAssignableFrom(parameterType)) {
            method.invoke(data, strictNumber ? value.longValueExact() : value.longValue());
        } else if (float.class.isAssignableFrom(parameterType) || Float.class.isAssignableFrom(parameterType)) {
            method.invoke(data, value.floatValue());
        } else if (double.class.isAssignableFrom(parameterType) || Double.class.isAssignableFrom(parameterType)) {
            method.invoke(data, value.doubleValue());
        }
    }

    /**
     * enum 값을 setter로 세팅한다.
     */
    private <T> void setEnumValue(T data, Method method, Cell cell, Class<?> parameterType)
        throws IllegalAccessException, InvocationTargetException {
        final var value = AppStringUtils.trimToNull(readCellText(cell));
        if (value == null) {
            return;
        }
        final var enumConstants = parameterType.getEnumConstants();

        Object enumValue = null;
        for (Object enumConstant : enumConstants) {
            if (enumConstant.toString().equals(value) || ((Enum<?>) enumConstant).name().equals(value)) {
                enumValue = enumConstant;
                break;
            }
        }

        if (enumValue != null) {
            method.invoke(data, parameterType.cast(enumValue));
            return;
        }

        if (log.isErrorEnabled()) {
            log.error(
                "Cannot apply data --> applicable type: CodeGroup({}), attempted value: {}",
                parameterType,
                value
            );
        }
        throw new MethodInvokeFailException("Value is not applicable for data setter.");
    }

    /**
     * 세팅에 허용된 파라미터 타입인지 확인한다.
     *
     * @param cellType      엑셀 셀 타입
     * @param parameterType setter 파라미터 타입
     * @return 허용 여부
     */
    public boolean allowSetParameterType(CellType cellType, Class<?> parameterType) {
        switch (cellType) {
            case NUMERIC -> {
                return (
                    parameterType.isPrimitive() ||
                    Short.class.isAssignableFrom(parameterType) ||
                    Integer.class.isAssignableFrom(parameterType) ||
                    Long.class.isAssignableFrom(parameterType) ||
                    Float.class.isAssignableFrom(parameterType) ||
                    Double.class.isAssignableFrom(parameterType) ||
                    String.class.isAssignableFrom(parameterType) ||
                    Date.class.isAssignableFrom(parameterType) ||
                    LocalDate.class.isAssignableFrom(parameterType) ||
                    LocalDateTime.class.isAssignableFrom(parameterType) ||
                    Calendar.class.isAssignableFrom(parameterType)
                );
            }
            case STRING -> {
                return (
                    parameterType.isEnum() ||
                    String.class.isAssignableFrom(parameterType) ||
                    Date.class.isAssignableFrom(parameterType) ||
                    LocalDate.class.isAssignableFrom(parameterType) ||
                    LocalDateTime.class.isAssignableFrom(parameterType) ||
                    Calendar.class.isAssignableFrom(parameterType)
                );
            }
            case BOOLEAN -> {
                return Boolean.class.isAssignableFrom(parameterType) || String.class.isAssignableFrom(parameterType);
            }
            case BLANK -> {
                return true;
            }
            default -> {
                if (log.isErrorEnabled()) {
                    log.error(
                        "Unprocessable parameter type - cellType: {}, parameterType: {}",
                        cellType,
                        parameterType
                    );
                }
                return false;
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 셀 쓰기 — 다운로드(생성) 시 사용
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 셀에 데이터를 세팅한다.
     *
     * @param cell         엑셀 셀
     * @param reqValue     세팅 요청 데이터
     * @param cellStyle    셀 스타일 (nullable)
     * @param dateFormat   날짜 포맷 (nullable)
     * @param numberFormat 숫자 포맷 (nullable)
     */
    public void setCell(Cell cell, Object reqValue, CellStyle cellStyle, String dateFormat, String numberFormat) {
        if (reqValue == null) {
            return;
        }

        if (reqValue instanceof Date value) {
            cell.setCellValue(value);
            applyDateStyle(cell, cellStyle, dateFormat, DEFAULT_DATE_CELL_FORMAT);
            return;
        }

        if (reqValue instanceof LocalDateTime value) {
            final var date = Date.from(value.atZone(zoneId).toInstant());
            cell.setCellValue(date);
            applyDateStyle(cell, cellStyle, dateFormat, DEFAULT_DATE_TIME_CELL_FORMAT);
            return;
        }

        if (reqValue instanceof LocalDate value) {
            final var date = Date.from(value.atStartOfDay(zoneId).toInstant());
            cell.setCellValue(date);
            applyDateStyle(cell, cellStyle, dateFormat, DEFAULT_DATE_CELL_FORMAT);
            return;
        }

        if (reqValue instanceof Calendar value) {
            cell.setCellValue(value);
            applyDateStyle(cell, cellStyle, dateFormat, DEFAULT_DATE_CELL_FORMAT);
            return;
        }

        if (reqValue instanceof Number value) {
            cell.setCellValue(value.doubleValue());
            final var style = getOrCreateStyle(
                cellStyle,
                cell.getSheet().getWorkbook(),
                numberFormat,
                numberStyleCache
            );
            if (style != null) {
                cell.setCellStyle(style);
            }
            return;
        }

        if (reqValue instanceof Boolean value) {
            cell.setCellValue(value);
        } else if (reqValue instanceof String value) {
            cell.setCellValue(value);
        } else if (reqValue instanceof Enum<?> value) {
            cell.setCellValue(value.name());
        } else {
            cell.setCellValue(reqValue.toString());
        }

        if (cellStyle != null) {
            cell.setCellStyle(cellStyle);
        }
    }

    /**
     * 날짜 셀에 스타일을 적용한다.
     */
    private void applyDateStyle(Cell cell, CellStyle cellStyle, String dateFormat, String defaultFormat) {
        final var style = getOrCreateStyle(
            cellStyle,
            cell.getSheet().getWorkbook(),
            formatOrDefault(dateFormat, defaultFormat),
            dateStyleCache
        );
        if (style != null) {
            cell.setCellStyle(style);
        }
    }

    /**
     * 날짜 포맷 목록을 통해 IntFunction을 생성한다.
     *
     * @param dateFormats 날짜 포맷 목록
     * @return 인덱스 기반 포맷 조회 함수
     */
    public IntFunction<String> dateFormatLookup(List<String> dateFormats) {
        return (index) -> findFormat(dateFormats, index);
    }

    /**
     * 숫자 포맷 목록을 통해 IntFunction을 생성한다.
     *
     * @param numberFormats 숫자 포맷 목록
     * @return 인덱스 기반 포맷 조회 함수
     */
    public IntFunction<String> numberFormatLookup(List<String> numberFormats) {
        return (index) -> findFormat(numberFormats, index);
    }

    /**
     * 캐시를 초기화한다.
     */
    public void clearCaches() {
        this.dateStyleCache.clear();
        this.numberStyleCache.clear();
    }

    // ─────────────────────────────────────────────────────────
    // 내부 헬퍼
    // ─────────────────────────────────────────────────────────

    /**
     * 문자열을 날짜/시간으로 파싱한다.
     *
     * @param text            문자열
     * @param preferredFormat 우선 포맷
     * @return LocalDateTime, 실패 시 null
     */
    @Nullable
    private LocalDateTime parseDateTime(String text, String preferredFormat) {
        final var formats = new ArrayList<String>();
        if (AppStringUtils.isNotBlank(preferredFormat)) {
            formats.add(preferredFormat);
        }
        if (AppStringUtils.isNotBlank(this.defaultDateFormat)) {
            formats.add(this.defaultDateFormat);
        }
        formats.addAll(this.inputDateFormats);
        formats.addAll(List.of("yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss", "yyyy/MM/dd", "yyyy.MM.dd"));

        for (String format : formats) {
            try {
                return LocalDateTime.parse(text, DateTimeFormatter.ofPattern(format));
            } catch (DateTimeParseException | IllegalArgumentException ignored) {
                // Try next format
            }
        }
        for (String format : formats) {
            try {
                return LocalDate.parse(text, DateTimeFormatter.ofPattern(format)).atStartOfDay();
            } catch (DateTimeParseException | IllegalArgumentException ignored) {
                // Try next format
            }
        }
        return null;
    }

    private static String formatOrDefault(String format, String defaultFormat) {
        if (AppStringUtils.isBlank(format)) {
            return defaultFormat;
        }
        return format;
    }

    @Nullable
    private String findFormat(List<String> formats, int index) {
        if (formats == null || formats.isEmpty() || index < 0 || index >= formats.size()) {
            return null;
        }
        return formats.get(index);
    }

    private CellStyle getOrCreateStyle(CellStyle base, Workbook workbook, String format, Map<String, CellStyle> cache) {
        if (AppStringUtils.isBlank(format) || workbook == null) {
            return base;
        }
        final var baseKey = (base == null) ? "null" : String.valueOf(base.getIndex());
        final var key = baseKey + ":" + format;
        return cache.computeIfAbsent(key, (k) -> {
            final var style = workbook.createCellStyle();
            if (base != null) {
                style.cloneStyleFrom(base);
            }
            style.setDataFormat(workbook.createDataFormat().getFormat(format));
            return style;
        });
    }

    // ─────────────────────────────────────────────────────────
    // 내부 예외
    // ─────────────────────────────────────────────────────────

    /**
     * Setter 파라미터 관련 오류.
     */
    static class BadParametersException extends RuntimeException {

        @Serial
        private static final long serialVersionUID = 6146781482760811278L;

        BadParametersException(String message) {
            super(message);
        }
    }

    /**
     * 메서드 실행 실패 오류.
     */
    static class MethodInvokeFailException extends RuntimeException {

        @Serial
        private static final long serialVersionUID = 2341269932991465388L;

        MethodInvokeFailException(String message) {
            super(message);
        }
    }
}
