package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.ExcelUtils;
import com.smarterd.utils.excel.ExcelData;
import com.smarterd.utils.excel.ExcelSheet;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 벌크 검증 오류 리포트 엑셀 생성을 담당한다.
 */
final class BulkExcelReportSupport {

    /**
     * 단일 시트 오류 리포트 엑셀을 생성한다.
     *
     * @param rows 오류 행 목록
     * @param rowClass 오류 행 타입
     * @param filePrefix 파일명 prefix
     * @param locale 로케일
     * @param titleCodes 컬럼 제목 메시지 코드
     * @param accessorNames record accessor 이름 순서
     * @param accessorError accessor 해석 실패 메시지
     * @param messageResolver 메시지 해석 함수
     * @param <T> 오류 행 타입
     * @return 엑셀 데이터
     */
    <T> ExcelData buildErrorReportExcel(
        List<T> rows,
        Class<T> rowClass,
        String filePrefix,
        Locale locale,
        List<String> titleCodes,
        List<String> accessorNames,
        String accessorError,
        BulkMessageResolver messageResolver
    ) {
        final var sheet = new ExcelSheet<T>();
        sheet.setSheetName(messageResolver.resolve("bulk.error-report.sheet-name", locale));
        sheet.setTitles(
            titleCodes
                .stream()
                .map((code) -> messageResolver.resolve(code, locale))
                .toList()
        );
        sheet.setReqMethods(resolveAccessorMethods(rowClass, accessorNames, accessorError));
        sheet.setDataList(rows);
        return new ExcelUtils<T>().toExcel(List.of(sheet), null, filePrefix);
    }

    /**
     * 오류 리포트용 record accessor 메서드 목록을 해석한다.
     *
     * @param rowClass 오류 리포트 행 클래스
     * @param methodNames 메서드 이름 순서
     * @param errorMessage 해석 실패 시 예외 메시지
     * @param <T> 오류 리포트 행 타입
     * @return accessor 메서드 목록
     */
    private <T> List<Method> resolveAccessorMethods(Class<T> rowClass, List<String> methodNames, String errorMessage) {
        try {
            final var methods = new ArrayList<Method>(methodNames.size());
            for (final var methodName : methodNames) {
                methods.add(rowClass.getMethod(methodName));
            }
            return List.copyOf(methods);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(errorMessage, e);
        }
    }
}
