package com.smarterd.utils.excel;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * 엑셀 데이터 추출을 위한 타이틀 및 메서드 셋.
 *
 * <pre>{@code
 * ExcelDataMethodSet set = new ExcelDataMethodSet()
 *         .add("이름", MyDto.class.getMethod("getName"))
 *         .add("수량", MyDto.class.getMethod("getCount"))
 *         .fileName("sample")
 *         .dateFormat("yyyy-MM-dd");
 *
 * ExcelUtils<MyDto> utils = new ExcelUtils<>(data, set);
 * ExcelData excel = utils.toExcel();
 * }</pre>
 */
@Getter
@Setter
public class ExcelDataMethodSet {

    private final List<String> titleList;
    private final List<Method> methodList;
    private final List<CellStyle> titleCellStyles;
    private final List<CellStyle> dataCellStyles;

    /** 엑셀 워크북 인스턴스 */
    private XSSFWorkbook book;
    /** 생성될 엑셀 파일명 (확장자 제외) */
    private String fileName;
    /** 기본 날짜 포맷 */
    private String dateFormat;
    /** 시트 이름 */
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
     * 데이터 추출 메서드를 추가합니다.
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
