package com.smarterd.utils.excel;

import java.lang.reflect.Method;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.apache.poi.ss.usermodel.CellStyle;

/**
 * 다중 시트 생성을 위한 시트 스펙.
 *
 * <pre>{@code
 * ExcelSheet<MyDto> sheet = new ExcelSheet<>();
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
public class ExcelSheet<T> {

    /** 시트 이름 */
    private String sheetName;
    /** 엑셀로 출력할 데이터 리스트 */
    private List<T> dataList;
    /** 데이터 추출에 사용할 getter 메서드 리스트 */
    private List<Method> reqMethods;
    /** 컬럼 헤더 타이틀 리스트 */
    private List<String> titles;
    /** 타이틀 행 셀 스타일 리스트 */
    private List<CellStyle> titleCellStyles;
    /** 데이터 행 셀 스타일 리스트 */
    private List<CellStyle> dataCellStyles;
    /** 컬럼별 날짜 포맷 리스트 */
    private List<String> dateFormats;
    /** 컬럼별 숫자 포맷 리스트 */
    private List<String> numberFormats;
}
