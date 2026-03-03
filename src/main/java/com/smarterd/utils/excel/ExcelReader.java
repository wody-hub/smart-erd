package com.smarterd.utils.excel;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;

/**
 * 엑셀 업로드/파싱을 담당하는 클래스.
 *
 * <p>MultipartFile로부터 엑셀 데이터를 추출(extractData)하고,
 * setter 메서드를 통해 POJO/record 객체에 매핑한다.</p>
 *
 * <pre>{@code
 * try (ExcelReader<MyDto> reader = new ExcelReader<>(file, setterMethods())) {
 *     ExcelExtract<MyDto> extract = reader
 *             .legacyNumericToString(true)
 *             .strictNumber(false)
 *             .extractData(MyDto.class, 1);
 *     List<MyDto> rows = extract.getDataList();
 * }
 * }</pre>
 *
 * @param <T> 추출 대상 데이터 타입
 */
@Slf4j
public class ExcelReader<T> implements AutoCloseable {

    private OPCPackage opcPackage;
    private XSSFWorkbook book;
    private XSSFSheet sheet;
    private List<Method> reqMethods;
    private final ExcelCellConverter cellConverter;

    /**
     * Excel 파일로부터 ExcelReader 객체를 생성한다.
     *
     * @param excel 업로드된 엑셀 파일
     * @throws IOException            파일 읽기 오류 발생 시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelReader(MultipartFile excel) throws IOException, InvalidFormatException {
        this(excel, null);
    }

    /**
     * Excel 파일과 메서드 리스트로부터 ExcelReader 객체를 생성한다.
     *
     * @param excel      업로드된 엑셀 파일
     * @param reqMethods 데이터 추출에 사용될 setter 메서드 리스트
     * @throws IOException            파일 읽기 오류 발생 시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelReader(MultipartFile excel, List<Method> reqMethods) throws IOException, InvalidFormatException {
        this.opcPackage = OPCPackage.open(excel.getInputStream());
        this.book = new XSSFWorkbook(opcPackage);
        this.sheet = book.getSheetAt(0);
        this.reqMethods = reqMethods;
        this.cellConverter = new ExcelCellConverter();
        this.cellConverter.setFormulaEvaluator(this.book.getCreationHelper().createFormulaEvaluator());
    }

    /**
     * 숫자 셀을 String으로 읽을 때 기존 동작(정수 캐스팅)을 유지할지 설정한다.
     *
     * @param legacyNumericToString legacy 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelReader<T> legacyNumericToString(boolean legacyNumericToString) {
        this.cellConverter.setLegacyNumericToString(legacyNumericToString);
        return this;
    }

    /**
     * 숫자 변환 시 정밀 변환 모드(소수/범위 오류 시 예외)를 설정한다.
     *
     * @param strictNumber strict 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelReader<T> strictNumber(boolean strictNumber) {
        this.cellConverter.setStrictNumber(strictNumber);
        return this;
    }

    /**
     * 엑셀로부터 데이터를 추출한다.
     *
     * @param clazz     데이터 생성 클래스
     * @param titleLine 타이틀 행 번호 (1부터 시작)
     * @return 추출된 데이터
     */
    public ExcelExtract<T> extractData(Class<T> clazz, int titleLine) {
        if (this.sheet == null) {
            throw new ExcelException("Sheet information does not exist for processing Excel data.");
        }
        if (clazz == null) {
            throw new ExcelException("Class type is required for creating Excel data objects.");
        }
        if (this.reqMethods == null || this.reqMethods.isEmpty()) {
            this.reqMethods = extractSetterMethod(clazz);
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
                            this.cellConverter.setData(instance, method, cell);
                        }
                    }
                    successCount++;
                } catch (ExcelCellConverter.BadParametersException e) {
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
            throw new ExcelException("Failed to create Excel data objects.");
        }
    }

    /**
     * setter 메서드를 추출한다.
     *
     * @param clazz 대상 클래스
     * @return setter 메서드 목록
     */
    private List<Method> extractSetterMethod(Class<T> clazz) {
        final var methods = clazz.getMethods();
        return Arrays.stream(methods).filter(this::isSetter).sorted(Comparator.comparing(Method::getName)).toList();
    }

    /**
     * setter 메서드인지 판별한다.
     *
     * @param method 대상 메서드
     * @return setter 여부
     */
    private boolean isSetter(Method method) {
        if (method == null) {
            return false;
        }
        if (!method.getName().startsWith("set")) {
            return false;
        }
        return method.getParameterCount() == 1 && method.getReturnType() == Void.TYPE;
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
    }
}
