package com.smarterd.utils;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Serial;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntFunction;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.NumberToTextConverter;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.web.multipart.MultipartFile;

/**
 * <h3>사용 설명서</h3>
 * <p>
 * 이 유틸은 엑셀 <b>내보내기(다운로드)</b>와 <b>가져오기(업로드)</b>를 모두 지원합니다.
 * </p>
 *
 * <h4>1) 엑셀 다운로드</h4>
 *
 * <pre>{@code
 * // 데이터 목록으로 엑셀 생성 후 다운로드
 * List<MyDto> data = service.getList();
 * ExcelUtils<MyDto> utils = new ExcelUtils<>(data, "파일명");
 * ExcelUtils.ExcelData excelData = utils.toExcel();
 * ExcelUtils.download(excelData, response);
 * }</pre>
 *
 * <h4>1-1) 다중 시트 다운로드</h4>
 *
 * <pre>{@code
 * ExcelUtils.ExcelSheet<UserDto> userSheet = new ExcelUtils.ExcelSheet<>();
 * userSheet.setSheetName("Users");
 * userSheet.setDataList(userList);
 *
 * ExcelUtils.ExcelSheet<LogDto> logSheet = new ExcelUtils.ExcelSheet<>();
 * logSheet.setSheetName("Logs");
 * logSheet.setDataList(logList);
 *
 * ExcelUtils<?> utils = new ExcelUtils<>();
 * ExcelUtils.ExcelData excelData = utils.toExcel(List.of(userSheet, logSheet), null, "multi-report");
 * ExcelUtils.download(excelData, response);
 * }</pre>
 *
 * <h4>2) 엑셀 업로드</h4>
 *
 * <pre>{@code
 * // 업로드 파일에서 데이터 추출 (titleLine: 1 -> 2행부터 데이터)
 * try (ExcelUtils<MyDto> utils = new ExcelUtils<>(excelFile, setterMethods())) {
 *     ExcelUtils.ExcelExtract<MyDto> extract = utils
 *             .legacyNumericToString(true) // 숫자->문자열 기존 동작 유지
 *             .strictNumber(false) // 기본: 소수/범위 오류 시 예외 미발생
 *             .extractData(MyDto.class, 1);
 *     List<MyDto> rows = extract.getDataList();
 * }
 * }</pre>
 *
 * <h4>3) 주요 옵션</h4>
 * <ul>
 * <li><b>legacyNumericToString</b>: 숫자 셀을 String으로 읽을 때 기존 방식(long 캐스팅) 유지
 * 여부</li>
 * <li><b>strictNumber</b>: 숫자 타입 변환 시 소수/범위 오류를 예외로 처리할지 여부</li>
 * <li><b>inputDateFormats</b>: 문자열 날짜 파싱을 위한 추가 포맷 목록</li>
 * <li><b>zoneId</b>: LocalDate/LocalDateTime 변환 기준</li>
 * </ul>
 *
 * @param <T>
 * @author 정재요
 */
@Slf4j
@NoArgsConstructor
public class ExcelUtils<T> implements AutoCloseable {

    private static final int MAX_SHEET_NAME_LENGTH = 31;
    private static final String DEFAULT_DATE_CELL_FORMAT = "yyyy-mm-dd";
    private static final String DEFAULT_DATE_TIME_CELL_FORMAT = "yyyy-mm-dd hh:mm:ss";

    private static boolean isEmpty(Collection<?> values) {
        return values == null || values.isEmpty();
    }

    private static boolean isNotEmpty(Collection<?> values) {
        return !isEmpty(values);
    }

    private static String formatOrDefault(String format, String defaultFormat) {
        if (StringUtils.isBlank(format)) {
            return defaultFormat;
        }
        return format;
    }

    private List<T> dataList;
    private List<Method> reqMethods;
    private List<String> titles;
    private List<CellStyle> titleCellStyles;
    private List<CellStyle> dataCellStyles;
    private String fileName;

    private OPCPackage opcPackage;
    private XSSFWorkbook book;
    private XSSFSheet sheet;
    private String sheetName;

    private final DataFormatter dataFormatter = new DataFormatter(Locale.KOREA);
    private FormulaEvaluator formulaEvaluator;
    private final Map<String, CellStyle> dateStyleCache = new HashMap<>();
    private final Map<String, CellStyle> numberStyleCache = new HashMap<>();
    private List<String> inputDateFormats = new ArrayList<>();
    private ZoneId zoneId = ZoneId.systemDefault();
    private boolean strictNumber = false;
    private boolean legacyNumericToString = true;

    @Setter
    @Getter
    private String defaultDateFormat = "yyyy-MM-dd'T'HH:mm:ss";

    /**
     * 문자열 날짜 파싱을 위한 추가 포맷 목록을 설정합니다.
     *
     * <pre>{@code
     * ExcelUtils<MyDto> utils = new ExcelUtils<>(file)
     *         .inputDateFormats(List.of("yyyyMMdd", "yyyy-MM-dd"))
     *         .zoneId(ZoneId.of("Asia/Seoul"));
     * }</pre>
     *
     * @param formats 날짜 포맷 목록
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> inputDateFormats(List<String> formats) {
        this.inputDateFormats = (formats == null) ? new ArrayList<>() : new ArrayList<>(formats);
        return this;
    }

    /**
     * 날짜 변환 시 사용할 기본 ZoneId를 설정합니다.
     *
     * <pre>{@code
     * new ExcelUtils<>(file).zoneId(ZoneId.of("Asia/Seoul"));
     * }</pre>
     *
     * @param zoneId ZoneId
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> zoneId(ZoneId zoneId) {
        if (zoneId != null) {
            this.zoneId = zoneId;
        }
        return this;
    }

    /**
     * 숫자 변환 시 정밀 변환 모드(소수/범위 오류 시 예외)를 설정합니다.
     *
     * <pre>{@code
     * // strict 모드: 소수 포함값/범위 초과 시 예외 발생
     * new ExcelUtils<>(file).strictNumber(true);
     * }</pre>
     *
     * @param strictNumber strict 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> strictNumber(boolean strictNumber) {
        this.strictNumber = strictNumber;
        return this;
    }

    /**
     * 숫자 셀을 String으로 읽을 때 기존 동작(정수 캐스팅)을 유지할지 설정합니다.
     *
     * <pre>{@code
     * // legacy=true: 1234.0 -> "1234" (기존 동작)
     * // legacy=false: 표시 형식 그대로 사용 (콤마, 소수, 선행 0 유지)
     * new ExcelUtils<>(file).legacyNumericToString(false);
     * }</pre>
     *
     * @param legacyNumericToString legacy 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> legacyNumericToString(boolean legacyNumericToString) {
        this.legacyNumericToString = legacyNumericToString;
        return this;
    }

    /**
     * 엑셀 생성 시 사용할 기본 시트명을 설정합니다.
     *
     * <pre>{@code
     * ExcelUtils<MyDto> utils = new ExcelUtils<>(data).sheetName("사용자목록");
     * ExcelUtils.ExcelData excel = utils.toExcel();
     * }</pre>
     *
     * @param sheetName 시트명
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> sheetName(String sheetName) {
        this.sheetName = sheetName;
        return this;
    }

    /**
     * 기본 생성자. 지정된 데이터 리스트로 ExcelUtils 객체를 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     */
    public ExcelUtils(List<T> dataList) {
        this.dataList = dataList;
    }

    /**
     * 파일명이 지정된 생성자. 지정된 데이터 리스트와 파일명으로 ExcelUtils 객체를 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param fileName 생성될 엑셀 파일의 이름
     */
    public ExcelUtils(List<T> dataList, String fileName) {
        this(dataList);
        this.fileName = fileName;
    }

    /**
     * 타이틀이 지정된 생성자. 지정된 데이터 리스트와 타이틀 리스트로 ExcelUtils 객체를 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param titles   엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelUtils(List<T> dataList, List<String> titles) {
        this(dataList);
        this.titles = titles;
    }

    /**
     * 메서드와 타이틀이 지정된 생성자. 지정된 데이터 리스트와 메서드 리스트, 타이틀 리스트로 ExcelUtils 객체를 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelUtils(List<T> dataList, List<Method> reqMethods, List<String> titles) {
        this(dataList, titles);
        this.reqMethods = reqMethods;
    }

    /**
     * 모든 속성이 지정된 생성자. 지정된 데이터 리스트와 메서드 리스트, 타이틀 리스트, 파일명으로 ExcelUtils 객체를 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     * @param fileName   생성될 엑셀 파일의 이름
     */
    public ExcelUtils(List<T> dataList, List<Method> reqMethods, List<String> titles, String fileName) {
        this(dataList, reqMethods, titles);
        this.fileName = fileName;
    }

    /**
     * ExcelDataMethodSet으로 지정된 생성자. 지정된 데이터 리스트와 ExcelDataMethodSet으로 ExcelUtils
     * 객체를 생성한다.
     *
     * @param dataList           엑셀로 변환할 데이터 리스트
     * @param excelDataMethodSet 엑셀 데이터 메서드 세트 (메서드 리스트, 타이틀 리스트, 파일명 포함)
     */
    public ExcelUtils(List<T> dataList, ExcelDataMethodSet excelDataMethodSet) {
        this(dataList);
        if (excelDataMethodSet != null) {
            this.reqMethods = excelDataMethodSet.getMethodList();
            this.titles = excelDataMethodSet.getTitleList();
            this.titleCellStyles = excelDataMethodSet.getTitleCellStyles();
            this.dataCellStyles = excelDataMethodSet.getDataCellStyles();
            this.fileName = excelDataMethodSet.getFileName();
            this.book = excelDataMethodSet.getBook();
            this.sheetName = excelDataMethodSet.getSheetName();
            if (StringUtils.isNotBlank(excelDataMethodSet.getDateFormat())) {
                this.defaultDateFormat = excelDataMethodSet.getDateFormat();
            }
        }
    }

    /**
     * Excel 파일로부터 ExcelUtils 객체를 생성한다.
     *
     * @param excel 업로드된 엑셀 파일
     * @throws IOException            파일 읽기 오류 발생시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelUtils(MultipartFile excel) throws IOException, InvalidFormatException {
        this(excel, null);
    }

    /**
     * Excel 파일과 메서드 리스트로부터 ExcelUtils 객체를 생성한다.
     *
     * @param excel      업로드된 엑셀 파일
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @throws IOException            파일 읽기 오류 발생시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelUtils(MultipartFile excel, List<Method> reqMethods) throws IOException, InvalidFormatException {
        this.opcPackage = OPCPackage.open(excel.getInputStream());
        this.book = new XSSFWorkbook(opcPackage);
        this.formulaEvaluator = this.book.getCreationHelper().createFormulaEvaluator();
        this.sheet = book.getSheetAt(0);
        this.reqMethods = reqMethods;
    }

    /**
     * 엑셀로부터 데이터 추출.
     *
     * <pre>{@code
     * try (ExcelUtils<MyDto> utils = new ExcelUtils<>(file, setterMethods())) {
     *     ExcelUtils.ExcelExtract<MyDto> extract = utils.extractData(MyDto.class, 1);
     *     List<MyDto> rows = extract.getDataList();
     * }
     * }</pre>
     *
     * @param clazz     데이터 생성 클래스
     * @param titleLine 타이틀 행 번호 (1부터 시작)
     * @return 추출된 데이터
     */
    public ExcelExtract<T> extractData(Class<T> clazz, int titleLine) {
        if (this.sheet == null) {
            throw new ExcelException("엑셀 데이터를 처리할 시트 정보가 존재하지 않습니다.");
        }
        if (clazz == null) {
            throw new ExcelException("엑셀 데이터 생성을 위한 클래스 type이 필요합니다.");
        }
        if (isEmpty(this.reqMethods)) {
            this.reqMethods = this.extractSetterMethod(clazz);
        }
        try {
            final var dataList = new ArrayList<T>();
            final var rowIterator = this.sheet.rowIterator();

            int totalCount = 0;
            int successCount = 0;
            int failCount = 0;
            int rowIndex = 0;
            while (rowIterator.hasNext()) {
                final var row = rowIterator.next();
                if (rowIndex++ <= (titleLine - 1)) {
                    continue;
                }
                final var instance = clazz.getDeclaredConstructor().newInstance();
                final var index = new AtomicInteger(0);
                try {
                    for (Method method : reqMethods) {
                        int andIncrement = index.getAndIncrement();
                        final var cell = row.getCell(andIncrement);
                        if (cell != null) {
                            this.setData(instance, method, cell);
                        }
                    }
                    successCount++;
                } catch (BadParametersException e) {
                    if (log.isErrorEnabled()) {
                        log.error(e.getMessage(), e);
                    }
                    failCount++;
                } finally {
                    totalCount++;
                }

                dataList.add(instance);
            }
            return new ExcelExtract<>(dataList, totalCount, successCount, failCount);
        } catch (
            InstantiationException
            | IllegalAccessException
            | InvocationTargetException
            | NoSuchMethodException e
        ) {
            if (log.isErrorEnabled()) {
                log.error(e.getMessage(), e);
            }
            throw new ExcelException("엑셀 데이터 객체 생성에 실패하였습니다.");
        }
    }

    /**
     * 수식 셀 포함 실제 셀 타입을 계산합니다.
     *
     * @param cell 셀
     * @return 셀 타입
     */
    private CellType resolveCellType(Cell cell) {
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
     * 셀 값을 문자열로 읽습니다.
     *
     * @param cell 셀
     * @return 문자열 값
     */
    private String readCellText(Cell cell) {
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
     * 숫자 셀 값을 BigDecimal로 읽습니다.
     *
     * @param cell 셀
     * @return 숫자 값
     */
    private BigDecimal readNumericCell(Cell cell) {
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

        final var text = readCellText(cell).replace(",", "").trim();
        if (text.isEmpty()) {
            return null;
        }
        return new BigDecimal(text);
    }

    /**
     * 문자열을 날짜/시간으로 파싱합니다.
     *
     * @param text            문자열
     * @param preferredFormat 우선 포맷
     * @return LocalDateTime, 실패 시 null
     */
    private LocalDateTime parseDateTime(String text, String preferredFormat) {
        final var formats = new ArrayList<String>();
        if (StringUtils.isNotBlank(preferredFormat)) {
            formats.add(preferredFormat);
        }
        if (StringUtils.isNotBlank(this.defaultDateFormat)) {
            formats.add(this.defaultDateFormat);
        }
        formats.addAll(this.inputDateFormats);
        formats.addAll(List.of("yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss", "yyyy/MM/dd", "yyyy.MM.dd"));

        for (String format : formats) {
            try {
                return LocalDateTime.parse(text, DateTimeFormatter.ofPattern(format));
            } catch (DateTimeParseException | IllegalArgumentException ignored) {}
        }
        for (String format : formats) {
            try {
                return LocalDate.parse(text, DateTimeFormatter.ofPattern(format)).atStartOfDay();
            } catch (DateTimeParseException | IllegalArgumentException ignored) {}
        }
        return null;
    }

    /**
     * 데이터 세팅
     *
     * @param data   데이터
     * @param method SET 메서드
     * @param cell   엑셀 값
     */
    private void setData(T data, Method method, Cell cell) {
        final var parameters = method.getParameters();
        if (ArrayUtils.isEmpty(parameters)) {
            throw new BadParametersException("세팅 파라미터가 존재하지 않아 데이터를 추출할 수 없습니다.");
        }

        final var cellType = resolveCellType(cell);
        if (cellType == CellType.BLANK) {
            return;
        }

        final var parameter = parameters[0]; // 세팅 파라미터는 첫번째 파라미터만 사용함.
        final var parameterType = parameter.getType();
        if (!this.allowSetParameterType(cellType, parameterType)) {
            if (log.isErrorEnabled()) {
                log.error(
                    "세팅에 허용된 파라미터 타입이 아닙니다. - cellType : {}, parameterType : {}, value : {}",
                    cellType,
                    parameterType,
                    cell
                );
            }
            throw new BadParametersException("세팅에 허용된 파라미터 타입이 아닙니다.");
        }

        try {
            if (String.class.isAssignableFrom(parameterType)) {
                method.invoke(data, readCellText(cell));
                return;
            }

            if (
                Date.class.isAssignableFrom(parameterType) ||
                LocalDateTime.class.isAssignableFrom(parameterType) ||
                LocalDate.class.isAssignableFrom(parameterType) ||
                Calendar.class.isAssignableFrom(parameterType)
            ) {
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

                final var text = readCellText(cell).trim();
                if (text.isEmpty()) {
                    return;
                }
                final var dateTime = parseDateTime(text, null);
                if (dateTime == null) {
                    throw new MethodInvokeFailException("날짜 파싱에 실패했습니다. value: " + text);
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
                return;
            }

            if (int.class.isAssignableFrom(parameterType) || Integer.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, strictNumber ? value.intValueExact() : value.intValue());
                return;
            }
            if (short.class.isAssignableFrom(parameterType) || Short.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, strictNumber ? value.shortValueExact() : value.shortValue());
                return;
            }
            if (byte.class.isAssignableFrom(parameterType) || Byte.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, strictNumber ? value.byteValueExact() : value.byteValue());
                return;
            }
            if (long.class.isAssignableFrom(parameterType) || Long.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, strictNumber ? value.longValueExact() : value.longValue());
                return;
            }
            if (float.class.isAssignableFrom(parameterType) || Float.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, value.floatValue());
                return;
            }
            if (double.class.isAssignableFrom(parameterType) || Double.class.isAssignableFrom(parameterType)) {
                final var value = readNumericCell(cell);
                if (value == null) {
                    return;
                }
                method.invoke(data, value.doubleValue());
                return;
            }

            if (parameterType.isEnum()) {
                final var value = readCellText(cell).trim();
                if (value.isEmpty()) {
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
                        "데이터를 적용할 수 없습니다. --> 적용 가능한 유형 : CodeGroup({}), 시도한 데이터 값 : {}",
                        parameterType,
                        value
                    );
                }
                throw new MethodInvokeFailException("데이터 세팅에 적용할 수 없는 값입니다.");
            }

            if (log.isErrorEnabled()) {
                log.error("메서드 실행에 허용되지 않은 파라미터 타입입니다. parameterType is {}", parameterType);
            }
            throw new MethodInvokeFailException("메서드 실행에 허용되지 않은 파라미터 타입입니다.");
        } catch (IllegalAccessException | InvocationTargetException e) {
            if (log.isErrorEnabled()) {
                log.error(e.getMessage(), e);
            }
            throw new MethodInvokeFailException("메서드 실행 중 오류가 발생했습니다.");
        }
    }

    /**
     * 세팅에 허용된 파라미터 타입 여부 확인
     *
     * @param cellType      엑셀 값 유형
     * @param parameterType 세팅 파라미터 type
     * @return 허용 여부
     */
    private boolean allowSetParameterType(CellType cellType, Class<?> parameterType) {
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
                        "처리할 수 없는 파라미터 유형입니다. - cellType : {}, parameterType : {}",
                        cellType,
                        parameterType
                    );
                }
                return false;
            }
        }
    }

    /**
     * 엑셀 데이터 생성 요청.
     *
     * <pre>{@code
     * ExcelUtils<MyDto> utils = new ExcelUtils<>(data);
     * ExcelUtils.ExcelData excel = utils.toExcel();
     * }</pre>
     *
     * @return 엑셀
     */
    public ExcelData toExcel() {
        return this.toExcel(this.dataList);
    }

    /**
     * 엑셀 데이터 생성 요청.
     *
     * <pre>{@code
     * ExcelUtils<MyDto> utils = new ExcelUtils<>(data);
     * ExcelUtils.ExcelData excel = utils.toExcel(data);
     * }</pre>
     *
     * @return 엑셀
     */
    public ExcelData toExcel(List<T> dataList) {
        return this.toExcel(
            dataList,
            this.reqMethods,
            this.titles,
            this.titleCellStyles,
            this.dataCellStyles,
            null,
            null,
            this.book,
            this.fileName
        );
    }

    /**
     * 엑셀 데이터 생성
     *
     * @param dataList   엑셀 데이터 요청
     * @param reqMethods 엑셀 데이터 처리 메서드
     * @param titles     타이틀
     * @param fileName   파일명
     * @return 엑셀
     */
    public ExcelData toExcel(
        List<T> dataList,
        List<Method> reqMethods,
        List<String> titles,
        List<CellStyle> titleCellStyles,
        List<CellStyle> dataCellStyles,
        List<String> dateFormats,
        XSSFWorkbook workBook,
        String fileName
    ) {
        return this.toExcel(
            dataList,
            reqMethods,
            titles,
            titleCellStyles,
            dataCellStyles,
            dateFormats,
            null,
            workBook,
            fileName
        );
    }

    /**
     * 엑셀 데이터 생성
     *
     * <pre>{@code
     * List<String> dateFormats = List.of("yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss");
     * List<String> numberFormats = List.of("#,##0", "#,##0.00");
     * ExcelUtils.ExcelData excel = utils.toExcel(
     *         data, methods, titles, titleStyles, dataStyles,
     *         dateFormats, numberFormats, null, "report");
     * }</pre>
     *
     * @param dataList      엑셀 데이터 요청
     * @param reqMethods    엑셀 데이터 처리 메서드
     * @param titles        타이틀
     * @param dateFormats   날짜 포맷 목록
     * @param numberFormats 숫자 포맷 목록
     * @param workBook      기존 워크북
     * @param fileName      파일명
     * @return 엑셀
     */
    public ExcelData toExcel(
        List<T> dataList,
        List<Method> reqMethods,
        List<String> titles,
        List<CellStyle> titleCellStyles,
        List<CellStyle> dataCellStyles,
        List<String> dateFormats,
        List<String> numberFormats,
        XSSFWorkbook workBook,
        String fileName
    ) {
        if (isEmpty(dataList)) {
            throw new ExcelException("엑셀 데이터가 비어 있어 파일을 생성할 수 없습니다.");
        }

        final var workbook = workBook == null ? new XSSFWorkbook() : workBook;
        final var sheetSpec = new ExcelSheet<T>();
        sheetSpec.setSheetName(this.sheetName);
        sheetSpec.setDataList(dataList);
        sheetSpec.setReqMethods(reqMethods);
        sheetSpec.setTitles(titles);
        sheetSpec.setTitleCellStyles(titleCellStyles);
        sheetSpec.setDataCellStyles(dataCellStyles);
        sheetSpec.setDateFormats(dateFormats);
        sheetSpec.setNumberFormats(numberFormats);

        if (!writeSheet(workbook, sheetSpec)) {
            throw new ExcelException("엑셀 시트를 생성할 수 없습니다.");
        }
        return new ExcelData(workbook, fileName);
    }

    /**
     * 다중 시트 엑셀 생성
     *
     * <pre>{@code
     * ExcelUtils.ExcelSheet<UserDto> userSheet = new ExcelUtils.ExcelSheet<>();
     * userSheet.setSheetName("Users");
     * userSheet.setDataList(userList);
     *
     * ExcelUtils.ExcelSheet<LogDto> logSheet = new ExcelUtils.ExcelSheet<>();
     * logSheet.setSheetName("Logs");
     * logSheet.setDataList(logList);
     *
     * ExcelUtils<?> utils = new ExcelUtils<>();
     * ExcelUtils.ExcelData excel = utils.toExcel(List.of(userSheet, logSheet), null, "multi-report");
     * }</pre>
     *
     * @param sheets   시트 구성 목록
     * @param workBook 기존 워크북(없으면 새로 생성)
     * @param fileName 파일명
     * @return 엑셀
     */
    public ExcelData toExcel(List<ExcelSheet<?>> sheets, XSSFWorkbook workBook, String fileName) {
        return this.toExcel(sheets, workBook, fileName, false);
    }

    /**
     * 다중 시트 엑셀 생성
     *
     * @param sheets          시트 구성 목록
     * @param workBook        기존 워크북(없으면 새로 생성)
     * @param fileName        파일명
     * @param skipFailedSheet 실패 시 시트를 건너뛸지 여부
     * @return 엑셀
     */
    public ExcelData toExcel(
        List<ExcelSheet<?>> sheets,
        XSSFWorkbook workBook,
        String fileName,
        boolean skipFailedSheet
    ) {
        if (isEmpty(sheets)) {
            throw new ExcelException("엑셀 시트 목록이 비어 있어 파일을 생성할 수 없습니다.");
        }
        final var workbook = workBook == null ? new XSSFWorkbook() : workBook;

        var createdCount = 0;
        for (ExcelSheet<?> sheetSpec : sheets) {
            if (sheetSpec == null) {
                continue;
            }
            try {
                final var created = writeSheet(workbook, sheetSpec);
                if (!created) {
                    if (skipFailedSheet) {
                        continue;
                    }
                    throw new ExcelException("엑셀 시트를 생성할 수 없습니다.");
                }
                createdCount++;
            } catch (ExcelException e) {
                if (skipFailedSheet) {
                    if (log.isWarnEnabled()) {
                        log.warn(e.getMessage(), e);
                    }
                    continue;
                }
                throw e;
            }
        }
        if (createdCount == 0) {
            throw new ExcelException("생성 가능한 엑셀 시트가 없습니다.");
        }
        return new ExcelData(workbook, fileName);
    }

    /**
     * 시트 생성 및 데이터 기록
     *
     * @param workbook  워크북
     * @param sheetSpec 시트 스펙
     */
    private boolean writeSheet(Workbook workbook, ExcelSheet<?> sheetSpec) {
        final var dataList = sheetSpec.getDataList();
        final var titles = sheetSpec.getTitles();
        final var reqMethods = sheetSpec.getReqMethods();
        final var titleStyles = sheetSpec.getTitleCellStyles();
        final var dataStyles = sheetSpec.getDataCellStyles();
        final var dateFormats = sheetSpec.getDateFormats();
        final var numberFormats = sheetSpec.getNumberFormats();

        if (isEmpty(dataList) && isEmpty(titles)) {
            return false;
        }

        final List<Method> excelMethod;
        if (isNotEmpty(reqMethods)) {
            excelMethod = reqMethods;
        } else if (isNotEmpty(dataList)) {
            excelMethod = this.extractGetterMethod(dataList.get(0));
        } else {
            excelMethod = Collections.emptyList();
        }

        if (isEmpty(excelMethod) && isNotEmpty(dataList)) {
            if (log.isWarnEnabled()) {
                log.warn("엑셀 데이터로 사용할 수 있는 getter 메서드가 없습니다.");
            }
            return false;
        }

        final var listSheet = workbook.createSheet(resolveSheetName(workbook, sheetSpec.getSheetName()));
        final var rowIndex = new AtomicInteger(0);

        final IntFunction<String> findDateFormat = (index) -> findFormat(dateFormats, index);
        final IntFunction<String> findNumberFormat = (index) -> findFormat(numberFormats, index);

        if (isNotEmpty(titles)) {
            final var row = listSheet.createRow(rowIndex.getAndIncrement());
            var cellIndex = 0;
            for (String title : titles) {
                final var titleCell = row.createCell(cellIndex);
                final var cellStyle = this.findCellStyle(titleStyles, cellIndex);
                titleCell.setCellValue(title);
                if (cellStyle != null) {
                    titleCell.setCellStyle(cellStyle);
                }
                cellIndex++;
            }
        }

        if (isEmpty(dataList) || isEmpty(excelMethod)) {
            return true;
        }

        dataList.forEach((data) -> {
            final var row = listSheet.createRow(rowIndex.getAndIncrement());
            var cellIndex = new AtomicInteger(0);

            excelMethod.forEach((method) -> {
                try {
                    final var index = cellIndex.getAndIncrement();
                    this.setCell(
                        row.createCell(index),
                        method.invoke(data),
                        this.findCellStyle(dataStyles, index),
                        findDateFormat.apply(index),
                        findNumberFormat.apply(index)
                    );
                    listSheet.autoSizeColumn(index);
                } catch (IllegalAccessException | InvocationTargetException e) {
                    if (log.isErrorEnabled()) {
                        log.error(data.toString());
                        log.error(e.getMessage(), e);
                    }
                    throw new ExcelException("엑셀을 생성할 수 없습니다.");
                }
            });
        });
        return true;
    }

    /**
     * 시트명 중복을 방지하며 유효한 시트명을 생성합니다.
     *
     * @param workbook      워크북
     * @param requestedName 요청 시트명
     * @return 최종 시트명
     */
    private String resolveSheetName(Workbook workbook, String requestedName) {
        if (StringUtils.isNotBlank(requestedName) && requestedName.length() > MAX_SHEET_NAME_LENGTH) {
            throw new ExcelException("시트명 길이가 초과되었습니다. (최대 31자)");
        }
        final var base = StringUtils.defaultIfBlank(requestedName, "list");
        final var safeBase = WorkbookUtil.createSafeSheetName(base);
        var name = safeBase;
        var suffix = 1;
        while (workbook.getSheet(name) != null) {
            suffix++;
            final var candidate = safeBase + "(" + suffix + ")";
            if (candidate.length() > MAX_SHEET_NAME_LENGTH) {
                throw new ExcelException("시트명 길이가 초과되었습니다. (최대 31자)");
            }
            name = candidate;
        }
        if (name.length() > MAX_SHEET_NAME_LENGTH) {
            throw new ExcelException("시트명 길이가 초과되었습니다. (최대 31자)");
        }
        return name;
    }

    /**
     * 지정된 인덱스에 해당하는 CellStyle 객체를 반환합니다.
     * 인덱스가 유효하지 않을 경우 null을 반환합니다.
     *
     * @param cellStyles CellStyle 객체 리스트
     * @param index      찾고자 하는 CellStyle의 인덱스
     * @return 인덱스에 해당하는 CellStyle 객체, 유효하지 않은 경우 null
     */
    private CellStyle findCellStyle(List<CellStyle> cellStyles, int index) {
        if (isEmpty(cellStyles) || index < 0 || index >= cellStyles.size()) {
            return null;
        }
        return cellStyles.get(index);
    }

    private String findFormat(List<String> formats, int index) {
        if (isEmpty(formats) || index < 0 || index >= formats.size()) {
            return null;
        }
        return formats.get(index);
    }

    /**
     * 포맷이 적용된 CellStyle을 캐시에서 가져오거나 생성합니다.
     *
     * @param base     기준 스타일
     * @param workbook 워크북
     * @param format   포맷 문자열
     * @param cache    캐시 맵
     * @return CellStyle
     */
    private CellStyle getOrCreateStyle(CellStyle base, Workbook workbook, String format, Map<String, CellStyle> cache) {
        if (StringUtils.isBlank(format) || workbook == null) {
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

    /**
     * 엑셀 셀에 데이터 세팅
     *
     * @param cell     엑셀 셀
     * @param reqValue 세팅 요청 데이터
     */
    private void setCell(Cell cell, Object reqValue, CellStyle cellStyle, String dateFormat, String numberFormat) {
        if (reqValue == null) {
            return;
        }

        if (reqValue instanceof Date value) {
            cell.setCellValue(value);
            final var style = getOrCreateStyle(
                cellStyle,
                cell.getSheet().getWorkbook(),
                formatOrDefault(dateFormat, DEFAULT_DATE_CELL_FORMAT),
                dateStyleCache
            );
            if (style != null) {
                cell.setCellStyle(style);
            }
            return;
        }

        if (reqValue instanceof LocalDateTime value) {
            final var date = Date.from(value.atZone(zoneId).toInstant());
            cell.setCellValue(date);
            final var style = getOrCreateStyle(
                cellStyle,
                cell.getSheet().getWorkbook(),
                formatOrDefault(dateFormat, DEFAULT_DATE_TIME_CELL_FORMAT),
                dateStyleCache
            );
            if (style != null) {
                cell.setCellStyle(style);
            }
            return;
        }

        if (reqValue instanceof LocalDate value) {
            final var date = Date.from(value.atStartOfDay(zoneId).toInstant());
            cell.setCellValue(date);
            final var style = getOrCreateStyle(
                cellStyle,
                cell.getSheet().getWorkbook(),
                formatOrDefault(dateFormat, DEFAULT_DATE_CELL_FORMAT),
                dateStyleCache
            );
            if (style != null) {
                cell.setCellStyle(style);
            }
            return;
        }

        if (reqValue instanceof Calendar value) {
            cell.setCellValue(value);
            final var style = getOrCreateStyle(
                cellStyle,
                cell.getSheet().getWorkbook(),
                formatOrDefault(dateFormat, DEFAULT_DATE_CELL_FORMAT),
                dateStyleCache
            );
            if (style != null) {
                cell.setCellStyle(style);
            }
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
     * 사용 가능한 메서드 추출
     *
     * @param data 데이터
     * @return 사용 가능한 메서드
     */
    private List<Method> extractGetterMethod(Object data) {
        final var methods = data.getClass().getMethods();
        return Arrays.stream(methods)
            .filter((method) -> {
                final var getterMethod = this.isGetter(method);
                final var allow = this.allowedReturnType(method);
                return getterMethod && allow;
            })
            .sorted(Comparator.comparing(Method::getName))
            .toList();
    }

    /**
     * 사용 가능한 메서드 추출
     *
     * @param clazz 데이터
     * @return 사용 가능한 메서드
     */
    private List<Method> extractSetterMethod(Class<T> clazz) {
        final var methods = clazz.getMethods();
        return Arrays.stream(methods).filter(this::isSetter).sorted(Comparator.comparing(Method::getName)).toList();
    }

    /**
     * 메서드 명이 getter 인지 여부 판단.
     *
     * @param method 메서드 명
     * @return getter 메서드 여부.
     */
    private boolean isGetter(Method method) {
        if (method == null) {
            return false;
        }
        if (!StringUtils.startsWith(method.getName(), "get")) {
            return false;
        }
        if ("getClass".equals(method.getName())) {
            return false;
        }
        return method.getParameterCount() == 0 && method.getReturnType() != Void.TYPE;
    }

    /**
     * 메서드 명이 setter 인지 여부 판단.
     *
     * @param method 메서드 명
     * @return getter 메서드 여부.
     */
    private boolean isSetter(Method method) {
        if (method == null) {
            return false;
        }
        if (!StringUtils.startsWith(method.getName(), "set")) {
            return false;
        }
        return method.getParameterCount() == 1 && method.getReturnType() == Void.TYPE;
    }

    /**
     * 엑셀 데이터로 사용 가능한 return type 인지 여부 판단함.
     *
     * @param method 메서드
     * @return 사용 가능한 return type 여부
     */
    private boolean allowedReturnType(Method method) {
        if (method == null) {
            return false;
        }

        final var returnType = method.getReturnType();
        if (returnType.isPrimitive()) {
            return true;
        }
        if (returnType.isEnum()) {
            return true;
        }

        return (
            String.class.isAssignableFrom(returnType) ||
            Date.class.isAssignableFrom(returnType) ||
            LocalDate.class.isAssignableFrom(returnType) ||
            LocalDateTime.class.isAssignableFrom(returnType) ||
            Byte.class.isAssignableFrom(returnType) ||
            Short.class.isAssignableFrom(returnType) ||
            Integer.class.isAssignableFrom(returnType) ||
            Long.class.isAssignableFrom(returnType) ||
            Float.class.isAssignableFrom(returnType) ||
            Double.class.isAssignableFrom(returnType) ||
            Boolean.class.isAssignableFrom(returnType) ||
            Calendar.class.isAssignableFrom(returnType)
        );
    }

    /**
     * 엑셀 파일 다운로드 요청
     *
     * <pre>{@code
     * ExcelUtils.ExcelData excel = utils.toExcel();
     * ExcelUtils.download(excel, response);
     * }</pre>
     *
     * @param excelData 엑셀
     * @param response  응답
     * @throws IOException e
     */
    public static void download(ExcelData excelData, HttpServletResponse response) throws IOException {
        download(excelData, response, null);
    }

    /**
     * 엑셀 파일 다운로드 요청
     *
     * <pre>{@code
     * ExcelUtils.download(excelData, response, "custom-name");
     * }</pre>
     *
     * @param excelData 엑셀
     * @param response  응답
     * @param name      다운로드 파일명(확장자 제외)
     * @throws IOException e
     */
    public static void download(ExcelData excelData, HttpServletResponse response, String name) throws IOException {
        if (excelData == null) {
            throw new ExcelException("다운로드할 엑셀 데이터가 없습니다.");
        }

        final var workbook = excelData.excelBook;
        if (workbook == null) {
            throw new ExcelException("다운로드할 엑셀 데이터가 없습니다.");
        }

        // 다운로드 파일명 생성.
        final var baseFileName = StringUtils.isNotBlank(name) ? name : excelData.fileName;
        final var fileName = StringUtils.defaultIfBlank(baseFileName, "excel") + ".xlsx";

        // 응답 객체 header 설 정 (엑셀)
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString()
        );

        // 엑셀 다운로드 처리.
        try (final var stream = response.getOutputStream()) {
            workbook.write(stream);
            workbook.close();
        } catch (IOException e) {
            if (log.isErrorEnabled()) {
                log.error("엑셀 다운로드 요청 중 오류가 발생하였습니다.");
                log.error(e.getMessage(), e);
            }
            workbook.close();
            throw new ExcelException("엑셀 다운로드 요청 중 오류가 발생하였습니다.");
        }
    }

    @Override
    public void close() throws IOException {
        if (this.book != null) {
            this.book.close();
            this.book = null;
        }
        if (this.opcPackage != null) {
            this.opcPackage.close();
            this.opcPackage = null;
        }
        this.formulaEvaluator = null;
        this.dateStyleCache.clear();
        this.numberStyleCache.clear();
    }

    public boolean isClosed() {
        return this.book == null && this.opcPackage == null;
    }

    /**
     * 생성된 엑셀 데이터.
     *
     * @param excelBook 엑셀 데이터
     * @param fileName  파일명
     * @author 정재요
     */
    public record ExcelData(Workbook excelBook, String fileName) {}

    /**
     * 다중 시트 생성을 위한 시트 스펙
     *
     * <pre>{@code
     * ExcelUtils.ExcelSheet<MyDto> sheet = new ExcelUtils.ExcelSheet<>();
     * sheet.setSheetName("MySheet");
     * sheet.setDataList(data);
     * sheet.setTitles(List.of("이름", "수량"));
     * sheet.setReqMethods(List.of(
     *         MyDto.class.getMethod("getName"),
     *         MyDto.class.getMethod("getCount")));
     * }</pre>
     *
     * @param <T> 데이터 타입
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExcelSheet<T> {

        private String sheetName;
        private List<T> dataList;
        private List<Method> reqMethods;
        private List<String> titles;
        private List<CellStyle> titleCellStyles;
        private List<CellStyle> dataCellStyles;
        private List<String> dateFormats;
        private List<String> numberFormats;
    }

    /**
     * 엑셀 데이터 추출 정보
     *
     * @param <T>
     * @author 정재요
     */
    @Getter
    @Setter
    @AllArgsConstructor
    public static class ExcelExtract<T> {

        /** 추출된 데이터 */
        private List<T> dataList;

        /** 추출 처리 총 건수 */
        private long totalRowCount;

        /** 추출 성공 건수 */
        private long successRowCount;

        /** 추출 실패 건수 */
        private long failRowCount;
    }

    /**
     * 엑셀 데이터 추출을 위한 타이틀 & 메서드 셋
     *
     * <pre>{@code
     * ExcelDataMethodSet set = new ExcelDataMethodSet()
     *         .add("이름", MyDto.class.getMethod("getName"))
     *         .add("수량", MyDto.class.getMethod("getCount"))
     *         .fileName("sample")
     *         .dateFormat("yyyy-MM-dd");
     *
     * ExcelUtils<MyDto> utils = new ExcelUtils<>(data, set);
     * ExcelUtils.ExcelData excel = utils.toExcel();
     * }</pre>
     *
     * @author 정재요
     */
    @Getter
    @Setter
    public static class ExcelDataMethodSet {

        private final List<String> titleList;
        private final List<Method> methodList;
        private final List<CellStyle> titleCellStyles;
        private final List<CellStyle> dataCellStyles;

        private XSSFWorkbook book;
        private String fileName;
        private String dateFormat;
        private String sheetName;

        public ExcelDataMethodSet() {
            this.titleList = new ArrayList<>();
            this.methodList = new ArrayList<>();
            this.titleCellStyles = new ArrayList<>();
            this.dataCellStyles = new ArrayList<>();
            this.book = new XSSFWorkbook();
        }

        /**
         * 데이터 타이틀과 추출 메서드를 추가합니다.
         *
         * @param title  데이터 타이틀
         * @param method 데이터 추출 메서드
         * @return 현재 객체(this)
         */
        public ExcelDataMethodSet add(String title, Method method) {
            return this.add(title, method, null);
        }

        /**
         * 데이터 타이틀, 메서드 및 셀 스타일을 추가합니다.
         *
         * @param title          타이틀
         * @param method         추출 메서드
         * @param titleCellStyle 타이틀 셀 스타일
         * @return 현재 객체(this)
         */
        public ExcelDataMethodSet add(String title, Method method, CellStyle titleCellStyle) {
            return this.add(title, method, titleCellStyle, null);
        }

        /**
         * 데이터 추출 메서드와 데이터 셀 스타일을 추가합니다.
         *
         * @param method 데이터를 추출하기 위한 메서드 객체
         * @return 현재 객체(this)
         */
        public ExcelDataMethodSet add(Method method) {
            return this.add(method, null);
        }

        /**
         * 데이터 추출 메서드와 데이터 셀 스타일을 추가합니다.
         *
         * @param method        데이터를 추출하기 위한 메서드 객체
         * @param dataCellStyle 데이터의 셀 스타일
         * @return 현재 객체(this)
         */
        public ExcelDataMethodSet add(Method method, CellStyle dataCellStyle) {
            return this.add(null, method, null, dataCellStyle);
        }

        /**
         * 데이터 타이틀, 추출 메서드 및 셀 스타일을 추가합니다.
         *
         * @param title          데이터 타이틀
         * @param method         데이터를 추출하기 위한 메서드 객체
         * @param titleCellStyle 타이틀의 셀 스타일
         * @param dataCellStyle  데이터의 셀 스타일
         * @return 현재 객체(this)
         */
        public ExcelDataMethodSet add(String title, Method method, CellStyle titleCellStyle, CellStyle dataCellStyle) {
            this.titleList.add(title);
            this.methodList.add(method);
            this.titleCellStyles.add(titleCellStyle);
            this.dataCellStyles.add(dataCellStyle);
            return this;
        }

        /**
         * 파일명을 설정합니다.
         *
         * @param fileName 설정할 파일명
         * @return 현재 ExcelDataMethodSet 객체
         */
        public ExcelDataMethodSet fileName(String fileName) {
            this.fileName = fileName;
            return this;
        }

        /**
         * 날짜 포맷을 설정합니다.
         *
         * @param dateFormat 설정할 날짜 포맷
         * @return 현재 ExcelDataMethodSet 객체
         */
        public ExcelDataMethodSet dateFormat(String dateFormat) {
            this.dateFormat = dateFormat;
            return this;
        }

        /**
         * 시트 이름을 설정합니다.
         *
         * @param sheetName 설정할 시트 이름
         * @return 현재 ExcelDataMethodSet 객체
         */
        public ExcelDataMethodSet sheetName(String sheetName) {
            this.sheetName = sheetName;
            return this;
        }

        /**
         * 새로운 셀 스타일(CellStyle)을 생성합니다.
         *
         * @return 생성된 셀 스타일 객체
         */
        public CellStyle createCellStyle() {
            return this.book.createCellStyle();
        }

        /**
         * 새로운 폰트(Font)를 생성합니다.
         *
         * @return 생성된 폰트 객체
         */
        public Font createFont() {
            return this.book.createFont();
        }
    }

    public static class ExcelException extends RuntimeException {

        public ExcelException(String message) {
            super(message);
        }
    }

    /**
     * 파라미터 관련 오류
     *
     * @author 정재요
     */
    private static class BadParametersException extends RuntimeException {

        @Serial
        private static final long serialVersionUID = 6146781482760811278L;

        public BadParametersException(String message) {
            super(message);
        }
    }

    /**
     * 메서드 실패 오류
     *
     * @author 정재요
     */
    private static class MethodInvokeFailException extends RuntimeException {

        @Serial
        private static final long serialVersionUID = 2341269932991465388L;

        public MethodInvokeFailException(String message) {
            super(message);
        }
    }
}
