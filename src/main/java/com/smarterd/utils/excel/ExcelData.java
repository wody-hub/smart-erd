package com.smarterd.utils.excel;

import org.apache.poi.ss.usermodel.Workbook;

/**
 * 생성된 엑셀 데이터.
 *
 * @param excelBook 엑셀 워크북
 * @param fileName  파일명
 */
public record ExcelData(Workbook excelBook, String fileName) {}
