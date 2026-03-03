package com.smarterd.utils;

import com.smarterd.utils.excel.ExcelCellConverter;
import com.smarterd.utils.excel.ExcelData;
import com.smarterd.utils.excel.ExcelDataMethodSet;
import com.smarterd.utils.excel.ExcelException;
import com.smarterd.utils.excel.ExcelExtract;
import com.smarterd.utils.excel.ExcelReader;
import com.smarterd.utils.excel.ExcelSheet;
import com.smarterd.utils.excel.ExcelWriter;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;

/**
 * 엑셀 내보내기(다운로드)와 가져오기(업로드)를 위한 파사드 클래스.
 *
 * <p>실제 로직은 다음 클래스들로 분리되어 있다:</p>
 * <ul>
 *   <li>{@link ExcelReader} -- 업로드/파싱 담당</li>
 *   <li>{@link ExcelWriter} -- 생성/다운로드 담당</li>
 *   <li>{@link ExcelCellConverter} -- 셀 타입 변환 담당</li>
 * </ul>
 *
 * <p>기존 호출 코드의 호환성을 유지하기 위해 이 클래스를 파사드로 남긴다.</p>
 *
 * @param <T> 데이터 타입
 */
@Slf4j
public class ExcelUtils<T> implements AutoCloseable {

    private ExcelReader<T> reader;
    private ExcelWriter<T> writer;

    // ─────────────────────────────────────────────────────────
    // 생성자 — 다운로드(쓰기)용
    // ─────────────────────────────────────────────────────────

    /**
     * 기본 생성자.
     */
    public ExcelUtils() {
        this.writer = new ExcelWriter<>();
    }

    /**
     * 데이터 리스트를 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     */
    public ExcelUtils(List<T> dataList) {
        this.writer = new ExcelWriter<>(dataList);
    }

    /**
     * 데이터 리스트와 파일명을 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param fileName 생성될 엑셀 파일의 이름
     */
    public ExcelUtils(List<T> dataList, String fileName) {
        this.writer = new ExcelWriter<>(dataList, fileName);
    }

    /**
     * 데이터 리스트와 타이틀 리스트를 지정하여 생성한다.
     *
     * @param dataList 엑셀로 변환할 데이터 리스트
     * @param titles   엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelUtils(List<T> dataList, List<String> titles) {
        this.writer = new ExcelWriter<>(dataList, titles);
    }

    /**
     * 데이터 리스트, 메서드 리스트, 타이틀 리스트를 지정하여 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     */
    public ExcelUtils(List<T> dataList, List<Method> reqMethods, List<String> titles) {
        this.writer = new ExcelWriter<>(dataList, reqMethods, titles);
    }

    /**
     * 데이터 리스트, 메서드 리스트, 타이틀 리스트, 파일명을 지정하여 생성한다.
     *
     * @param dataList   엑셀로 변환할 데이터 리스트
     * @param reqMethods 데이터 추출에 사용될 메서드 리스트
     * @param titles     엑셀 파일의 컬럼 타이틀 리스트
     * @param fileName   생성될 엑셀 파일의 이름
     */
    public ExcelUtils(List<T> dataList, List<Method> reqMethods, List<String> titles, String fileName) {
        this.writer = new ExcelWriter<>(dataList, reqMethods, titles, fileName);
    }

    /**
     * ExcelDataMethodSet으로 생성한다.
     *
     * @param dataList           엑셀로 변환할 데이터 리스트
     * @param excelDataMethodSet 엑셀 데이터 메서드 세트
     */
    public ExcelUtils(List<T> dataList, ExcelDataMethodSet excelDataMethodSet) {
        this.writer = new ExcelWriter<>(dataList, excelDataMethodSet);
    }

    // ─────────────────────────────────────────────────────────
    // 생성자 — 업로드(읽기)용
    // ─────────────────────────────────────────────────────────

    /**
     * Excel 파일로부터 ExcelUtils 객체를 생성한다.
     *
     * @param excel 업로드된 엑셀 파일
     * @throws IOException            파일 읽기 오류 발생 시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelUtils(MultipartFile excel) throws IOException, InvalidFormatException {
        this.reader = new ExcelReader<>(excel);
    }

    /**
     * Excel 파일과 메서드 리스트로부터 ExcelUtils 객체를 생성한다.
     *
     * @param excel      업로드된 엑셀 파일
     * @param reqMethods 데이터 추출에 사용될 setter 메서드 리스트
     * @throws IOException            파일 읽기 오류 발생 시
     * @throws InvalidFormatException 잘못된 엑셀 파일 형식일 경우
     */
    public ExcelUtils(MultipartFile excel, List<Method> reqMethods) throws IOException, InvalidFormatException {
        this.reader = new ExcelReader<>(excel, reqMethods);
    }

    // ─────────────────────────────────────────────────────────
    // 업로드(읽기) 옵션 — fluent API
    // ─────────────────────────────────────────────────────────

    /**
     * 숫자 셀을 String으로 읽을 때 기존 동작(정수 캐스팅)을 유지할지 설정한다.
     *
     * @param legacyNumericToString legacy 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> legacyNumericToString(boolean legacyNumericToString) {
        if (this.reader != null) {
            this.reader.legacyNumericToString(legacyNumericToString);
        }
        return this;
    }

    /**
     * 숫자 변환 시 정밀 변환 모드(소수/범위 오류 시 예외)를 설정한다.
     *
     * @param strictNumber strict 모드 여부
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> strictNumber(boolean strictNumber) {
        if (this.reader != null) {
            this.reader.strictNumber(strictNumber);
        }
        return this;
    }

    // ─────────────────────────────────────────────────────────
    // 다운로드(쓰기) 옵션 — fluent API
    // ─────────────────────────────────────────────────────────

    /**
     * 시트명을 설정한다.
     *
     * @param sheetName 시트명
     * @return 현재 객체(this)
     */
    public ExcelUtils<T> sheetName(String sheetName) {
        if (this.writer != null) {
            this.writer.sheetName(sheetName);
        }
        return this;
    }

    // ─────────────────────────────────────────────────────────
    // 데이터 추출 (읽기 위임)
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀로부터 데이터를 추출한다.
     *
     * @param clazz     데이터 생성 클래스
     * @param titleLine 타이틀 행 번호 (1부터 시작)
     * @return 추출된 데이터
     */
    public ExcelExtract<T> extractData(Class<T> clazz, int titleLine) {
        if (this.reader == null) {
            throw new ExcelException("ExcelUtils was not initialized for reading. Use the MultipartFile constructor.");
        }
        return this.reader.extractData(clazz, titleLine);
    }

    // ─────────────────────────────────────────────────────────
    // 엑셀 생성 (쓰기 위임)
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 데이터를 생성한다.
     *
     * @return 엑셀 데이터
     */
    public ExcelData toExcel() {
        ensureWriter();
        return this.writer.toExcel();
    }

    /**
     * 지정된 데이터 리스트로 엑셀 데이터를 생성한다.
     *
     * @param dataList 데이터 리스트
     * @return 엑셀 데이터
     */
    public ExcelData toExcel(List<T> dataList) {
        ensureWriter();
        return this.writer.toExcel(dataList);
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
        XSSFWorkbook workBook,
        String fileName
    ) {
        ensureWriter();
        return this.writer.toExcel(
            dataList,
            reqMethods,
            titles,
            titleCellStyles,
            dataCellStyles,
            dateFormats,
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
        ensureWriter();
        return this.writer.toExcel(
            dataList,
            reqMethods,
            titles,
            titleCellStyles,
            dataCellStyles,
            dateFormats,
            numberFormats,
            workBook,
            fileName
        );
    }

    /**
     * 다중 시트 엑셀을 생성한다.
     *
     * @param sheets   시트 구성 목록
     * @param workBook 기존 워크북(없으면 새로 생성)
     * @param fileName 파일명
     * @return 엑셀 데이터
     */
    public ExcelData toExcel(List<ExcelSheet<?>> sheets, XSSFWorkbook workBook, String fileName) {
        ensureWriter();
        return this.writer.toExcel(sheets, workBook, fileName);
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
        ensureWriter();
        return this.writer.toExcel(sheets, workBook, fileName, skipFailedSheet);
    }

    // ─────────────────────────────────────────────────────────
    // 다운로드 (static 위임)
    // ─────────────────────────────────────────────────────────

    /**
     * 엑셀 파일을 HTTP 응답으로 다운로드한다.
     *
     * @param excelData 엑셀 데이터
     * @param response  HTTP 응답
     * @throws IOException 다운로드 오류 발생 시
     */
    public static void download(ExcelData excelData, HttpServletResponse response) throws IOException {
        ExcelWriter.download(excelData, response);
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
        ExcelWriter.download(excelData, response, name);
    }

    // ─────────────────────────────────────────────────────────
    // AutoCloseable
    // ─────────────────────────────────────────────────────────

    @Override
    public void close() throws IOException {
        if (this.reader != null) {
            this.reader.close();
            this.reader = null;
        }
        if (this.writer != null) {
            this.writer.close();
            this.writer = null;
        }
    }

    private void ensureWriter() {
        if (this.writer == null) {
            this.writer = new ExcelWriter<>();
        }
    }
}
