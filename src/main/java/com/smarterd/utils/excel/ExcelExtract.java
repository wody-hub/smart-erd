package com.smarterd.utils.excel;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

/**
 * 엑셀 데이터 추출 결과.
 *
 * @param <T> 추출된 데이터 타입
 */
@Getter
@Setter
@AllArgsConstructor
public class ExcelExtract<T> {

    /** 추출된 데이터 */
    private List<T> dataList;

    /** 추출 처리 총 건수 */
    private long totalRowCount;

    /** 추출 성공 건수 */
    private long successRowCount;

    /** 추출 실패 건수 */
    private long failRowCount;
}
