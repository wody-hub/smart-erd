package com.smarterd.utils.excel;

import com.smarterd.utils.AppStringUtils;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collection;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.Nullable;

/**
 * 엑셀 생성/다운로드를 담당하는 클래스.
 *
 * <p>데이터 리스트를 엑셀 워크북으로 변환하고 HTTP 응답으로 다운로드하는 기능을 제공한다.</p>
 *
 * <pre>{@code
 * ExcelWriter<MyDto> writer = new ExcelWriter<>(data, titles);
 * writer.sheetName("사용자목록");
 * ExcelData excel = writer.toExcel();
 * ExcelWriter.download(excel, response);
 * }</pre>
 *
 * @param <T> 데이터 타입
 */
@Slf4j
public class ExcelWriter<T> implements AutoCloseable {

    private static final int MAX_SHEET_NAME_LENGTH = 31;

    private List<T> dataList;
    private List<Method> reqMethods;
    private List<String> titles;
    private List<CellStyle> titleCellStyles;
    private List<CellStyle> dataCellStyles;
    private String fileName;
    private XSSFWorkbook book;
    private String sheetName;

    private final ExcelCellConverter cellConverter;

    /**
     * 기본 생성자.
     */
    public ExcelWriter() {
        this.cellConverter = new ExcelCellConverter();
    }

    /**
     * 데이터 리스트를 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     */
    public ExcelWriter(List<T> dataList) {
        this();
        this.dataList = dataList;
    }

    /**
     * 데이터 리스트와 파일명을 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param fileName 생성될 엑셀 파일의 이름
     */
    public ExcelWriter(List<T> dataList, String fileName) {
        this(dataList);
        this.fileName = fileName;
    }

    /**
     * 데이터 리스트와 타이틀 리스트를 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param titles   엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelWriter(List<T> dataList, List<String> titles) {
        this(dataList);
        this.titles = titles;
    }

    /**
     * 데이터 리스트, 메서드 리스트, 타이틀 리스트를 지정하여 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelWriter(List<T> dataList, List<Method> reqMethods, List<String> titles) {
        this(dataList, titles);
        this.reqMethods = reqMethods;
    }

    /**
     * 데이터 리스트, 메서드 리스트, 타이틀 리스트, 파일명을 지정하여 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     * @param fileName   생성될 엑셀 파일의 이름
     */
    public ExcelWriter(List<T> dataList, List<Method> reqMethods, List<String> titles, String fileName) {
        this(dataList, reqMethods, titles);
        this.fileName = fileName;
    }

    /**
     * ExcelDataMethodSet으로 생성한다.
     *
     * @param dataList           엑셀로 변환할 데이터 리스트
     * @param excelDataMethodSet 엑셀 데이터 메서드 세트
     */
    public ExcelWriter(List<T> dataList, ExcelDataMethodSet excelDataMethodSet) {
        this(dataList);
        if (excelDataMethodSet != null) {
            this.reqMethods = excelDataMethodSet.getMethodList();
            this.titles = excelDataMethodSet.getTitleList();
            this.titleCellStyles = excelDataMethodSet.getTitleCellStyles();
            this.dataCellStyles = excelDataMethodSet.getDataCellStyles();
            this.fileName = excelDataMethodSet.getFileName();
            this.book = excelDataMethodSet.getBook();
            this.sheetName = excelDataMethodSet.getSheetName();
            if (AppStringUtils.isNotBlank(excelDataMethodSet.getDateFormat())) {
                this.cellConverter.setDefaultDateFormat(excelDataMethodSet.getDateFormat());
            }
        }
    }

    /**
     * 시트명을 설정한다.
     *
     * @param sheetName 시트명
     * @return 현재 객체(this)
     */
    public ExcelWriter<T> sheetName(String sheetName) {
        this.sheetName = sheetName;
        return this;
    }

    /**
     * 기본 날짜 포맷을 반환한다.
     *
     * @return 기본 날짜 포맷 문자열
     */
    public String getDefaultDateFormat() {
        return cellConverter.getDefaultDateFormat();
    }

    /**
     * 기본 날짜 포맷을 설정한다.
     *
     * @param defaultDateFormat 날짜 포맷 문자열
     */
    public void setDefaultDateFormat(String defaultDateFormat) {
        this.cellConverter.setDefaultDateFormat(defaultDateFormat);
    }

    // ─────────────────────────────────────────────────────────
    // 단일 시트 생성
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 데이터를 생성한다.
     *
     * @return 엑셀 데이터
     */
    public ExcelData toExcel() {
        return this.toExcel(this.dataList);
    }

    /**
     * 지정된 데이터 리스트로 엑셀 데이터를 생성한다.
     *
     * @param dataList 데이터 리스트
     * @return 엑셀 데이터
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
     * 엑셀 데이터를 생성한다.
     *
     * @param dataList       데이터 리스트
     * @param reqMethods     데이터 처리 메서드
     * @param titles         타이틀
     * @param titleCellStyles 타이틀 셀 스타일
     * @param dataCellStyles  데이터 셀 스타일
     * @param dateFormats    날짜 포맷 목록
     * @param workBook       기존 워크북
     * @param fileName       파일명
     * @return 엑셀 데이터
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
     * 엑셀 데이터를 생성한다.
     *
     * @param dataList        데이터 리스트
     * @param reqMethods      데이터 처리 메서드
     * @param titles          타이틀
     * @param titleCellStyles 타이틀 셀 스타일
     * @param dataCellStyles  데이터 셀 스타일
     * @param dateFormats     날짜 포맷 목록
     * @param numberFormats   숫자 포맷 목록
     * @param workBook        기존 워크북
     * @param fileName        파일명
     * @return 엑셀 데이터
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
            throw new ExcelException("Excel data is empty; cannot create file.");
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
            throw new ExcelException("Cannot create Excel sheet.");
        }
        return new ExcelData(workbook, fileName);
    }

    // ─────────────────────────────────────────────────────────
    // 다중 시트 생성
    // ─────────────────────────────────────────────────────────

    /**
     * 다중 시트 엑셀을 생성한다.
     *
     * @param sheets   시트 구성 목록
     * @param workBook 기존 워크북(없으면 새로 생성)
     * @param fileName 파일명
     * @return 엑셀 데이터
     */
    public ExcelData toExcel(List<ExcelSheet<?>> sheets, XSSFWorkbook workBook, String fileName) {
        return this.toExcel(sheets, workBook, fileName, false);
    }

    /**
     * 다중 시트 엑셀을 생성한다.
     *
     * @param sheets          시트 구성 목록
     * @param workBook        기존 워크북(없으면 새로 생성)
     * @param fileName        파일명
     * @param skipFailedSheet 실패 시 시트를 건너뛸지 여부
     * @return 엑셀 데이터
     */
    public ExcelData toExcel(
        List<ExcelSheet<?>> sheets,
        XSSFWorkbook workBook,
        String fileName,
        boolean skipFailedSheet
    ) {
        if (isEmpty(sheets)) {
            throw new ExcelException("Excel sheet list is empty; cannot create file.");
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
                    throw new ExcelException("Cannot create Excel sheet.");
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
            throw new ExcelException("No creatable Excel sheets found.");
        }
        return new ExcelData(workbook, fileName);
    }

    // ─────────────────────────────────────────────────────────
    // 다운로드
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 파일을 HTTP 응답으로 다운로드한다.
     *
     * @param excelData 엑셀 데이터
     * @param response  HTTP 응답
     * @throws IOException 다운로드 오류 발생 시
     */
    public static void download(ExcelData excelData, HttpServletResponse response) throws IOException {
        download(excelData, response, null);
    }

    /**
     * 엑셀 파일을 HTTP 응답으로 다운로드한다.
     *
     * @param excelData 엑셀 데이터
     * @param response  HTTP 응답
     * @param name      다운로드 파일명(확장자 제외)
     * @throws IOException 다운로드 오류 발생 시
     */
    public static void download(ExcelData excelData, HttpServletResponse response, String name) throws IOException {
        if (excelData == null) {
            throw new ExcelException("No Excel data to download.");
        }

        final var workbook = excelData.excelBook();
        if (workbook == null) {
            throw new ExcelException("No Excel data to download.");
        }

        final var baseFileName = AppStringUtils.isNotBlank(name) ? name : excelData.fileName();
        final var fileName = AppStringUtils.defaultIfBlank(baseFileName, "excel") + ".xlsx";

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build().toString()
        );

        try (final var stream = response.getOutputStream()) {
            workbook.write(stream);
            workbook.close();
        } catch (IOException e) {
            if (log.isErrorEnabled()) {
                log.error("Error occurred while downloading Excel file.");
                log.error(e.getMessage(), e);
            }
            workbook.close();
            throw new ExcelException("Error occurred while downloading Excel file.");
        }
    }

    @Override
    public void close() throws IOException {
        if (this.book != null) {
            this.book.close();
            this.book = null;
        }
        this.cellConverter.clearCaches();
    }

    // ─────────────────────────────────────────────────────────
    // 시트 생성 내부 로직
    // ─────────────────────────────────────────────────────────

    /**
     * 시트를 생성하고 데이터를 기록한다.
     *
     * @param workbook  워크북
     * @param sheetSpec 시트 스펙
     * @return 시트 생성 성공 여부
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
            excelMethod = extractGetterMethod(dataList.get(0));
        } else {
            excelMethod = List.of();
        }

        if (isEmpty(excelMethod) && isNotEmpty(dataList)) {
            if (log.isWarnEnabled()) {
                log.warn("No usable getter methods for Excel data.");
            }
            return false;
        }

        final var listSheet = workbook.createSheet(resolveSheetName(workbook, sheetSpec.getSheetName()));
        final var rowIndex = new AtomicInteger(0);

        final var findDateFormat = cellConverter.dateFormatLookup(dateFormats);
        final var findNumberFormat = cellConverter.numberFormatLookup(numberFormats);

        if (isNotEmpty(titles)) {
            final var row = listSheet.createRow(rowIndex.getAndIncrement());
            var cellIndex = 0;
            for (String title : titles) {
                final var titleCell = row.createCell(cellIndex);
                final var cellStyle = findCellStyle(titleStyles, cellIndex);
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
                    this.cellConverter.setCell(
                        row.createCell(index),
                        method.invoke(data),
                        findCellStyle(dataStyles, index),
                        findDateFormat.apply(index),
                        findNumberFormat.apply(index)
                    );
                    listSheet.autoSizeColumn(index);
                } catch (IllegalAccessException | InvocationTargetException e) {
                    if (log.isErrorEnabled()) {
                        log.error(data.toString());
                        log.error(e.getMessage(), e);
                    }
                    throw new ExcelException("Cannot create Excel.");
                }
            });
        });
        return true;
    }

    /**
     * 시트명 중복을 방지하며 유효한 시트명을 생성한다.
     *
     * @param workbook      워크북
     * @param requestedName 요청 시트명
     * @return 최종 시트명
     */
    private String resolveSheetName(Workbook workbook, String requestedName) {
        if (AppStringUtils.isNotBlank(requestedName) && requestedName.length() > MAX_SHEET_NAME_LENGTH) {
            throw new ExcelException("Sheet name exceeds maximum length (31 characters).");
        }
        final var base = AppStringUtils.defaultIfBlank(requestedName, "list");
        final var safeBase = WorkbookUtil.createSafeSheetName(base);
        var name = safeBase;
        var suffix = 1;
        while (workbook.getSheet(name) != null) {
            suffix++;
            final var candidate = safeBase + "(" + suffix + ")";
            if (candidate.length() > MAX_SHEET_NAME_LENGTH) {
                throw new ExcelException("Sheet name exceeds maximum length (31 characters).");
            }
            name = candidate;
        }
        if (name.length() > MAX_SHEET_NAME_LENGTH) {
            throw new ExcelException("Sheet name exceeds maximum length (31 characters).");
        }
        return name;
    }

    /**
     * getter 메서드를 추출한다.
     * record 클래스는 RecordComponent 선언 순서를 유지하고, POJO는 알파벳순 정렬을 유지한다.
     *
     * @param data 데이터 객체
     * @return getter 메서드 목록
     */
    private List<Method> extractGetterMethod(Object data) {
        final var clazz = data.getClass();

        if (clazz.isRecord()) {
            return Arrays.stream(clazz.getRecordComponents())
                .map(RecordComponent::getAccessor)
                .filter(this::allowedReturnType)
                .toList();
        }

        final var methods = clazz.getMethods();
        return Arrays.stream(methods)
            .filter((method) -> {
                final var getterMethod = isGetter(method);
                final var allow = allowedReturnType(method);
                return getterMethod && allow;
            })
            .sorted(Comparator.comparing(Method::getName))
            .toList();
    }

    /**
     * getter 메서드인지 판별한다.
     *
     * @param method 대상 메서드
     * @return getter 여부
     */
    private boolean isGetter(Method method) {
        if (method == null) {
            return false;
        }
        if (method.getParameterCount() != 0 || method.getReturnType() == Void.TYPE) {
            return false;
        }

        if (AppStringUtils.startsWith(method.getName(), "get") && !"getClass".equals(method.getName())) {
            return true;
        }

        final var declaringClass = method.getDeclaringClass();
        if (declaringClass.isRecord()) {
            final var components = declaringClass.getRecordComponents();
            for (final var component : components) {
                if (component.getName().equals(method.getName())) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * 엑셀 데이터로 사용 가능한 반환 타입인지 판별한다.
     *
     * @param method 대상 메서드
     * @return 사용 가능 여부
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

    @Nullable
    private CellStyle findCellStyle(List<CellStyle> cellStyles, int index) {
        if (isEmpty(cellStyles) || index < 0 || index >= cellStyles.size()) {
            return null;
        }
        return cellStyles.get(index);
    }

    private static boolean isEmpty(Collection<?> values) {
        return values == null || values.isEmpty();
    }

    private static boolean isNotEmpty(Collection<?> values) {
        return !isEmpty(values);
    }
}
