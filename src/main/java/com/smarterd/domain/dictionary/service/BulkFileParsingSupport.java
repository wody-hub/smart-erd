package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.CsvParser;
import com.smarterd.utils.ExcelUtils;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.springframework.web.multipart.MultipartFile;

/**
 * 벌크 업로드 파일 파싱을 담당한다.
 *
 * @param <R> 엑셀 업로드 행 타입
 */
final class BulkFileParsingSupport<R> {

    private final Class<R> rowClass;
    private final List<String> excelColumnKeys;
    private final Function<R, Map<String, String>> uploadRowMapper;
    private final Function<String[], Map<String, String>> csvFieldsMapper;

    /**
     * @param rowClass 엑셀 업로드 행 타입
     * @param excelColumnKeys 엑셀 컬럼 키 순서
     * @param uploadRowMapper 엑셀 행 매핑 함수
     * @param csvFieldsMapper CSV 필드 매핑 함수
     */
    BulkFileParsingSupport(
        Class<R> rowClass,
        List<String> excelColumnKeys,
        Function<R, Map<String, String>> uploadRowMapper,
        Function<String[], Map<String, String>> csvFieldsMapper
    ) {
        this.rowClass = rowClass;
        this.excelColumnKeys = excelColumnKeys;
        this.uploadRowMapper = uploadRowMapper;
        this.csvFieldsMapper = csvFieldsMapper;
    }

    /**
     * 업로드 파일을 파싱하여 행별 필드 맵 목록을 반환한다.
     *
     * @param file 업로드 파일
     * @param fileName 원본 파일명
     * @return 파싱된 행 목록
     */
    List<Map<String, String>> parseFile(MultipartFile file, String fileName) {
        final var normalizedFileName = AppStringUtils.trimToNull(fileName);
        if (!AppStringUtils.endsWithAnyIgnoreCase(normalizedFileName, ".xlsx", ".csv")) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
        return AppStringUtils.endsWithIgnoreCase(normalizedFileName, ".xlsx") ? parseExcel(file) : parseCsv(file);
    }

    /**
     * 엑셀 파일을 파싱한다.
     *
     * @param file 엑셀 파일
     * @return 파싱된 행 목록
     */
    private List<Map<String, String>> parseExcel(MultipartFile file) {
        final var orderedSetters = resolveOrderedSetters();
        try (
            final var excelUtils = orderedSetters.isEmpty()
                ? new ExcelUtils<R>(file)
                : new ExcelUtils<R>(file, orderedSetters)
        ) {
            final var extract = excelUtils.legacyNumericToString(true).strictNumber(false).extractData(rowClass, 1);
            return extract.getDataList().stream().map(uploadRowMapper).filter(this::hasAnyValue).toList();
        } catch (IOException | InvalidFormatException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
    }

    /**
     * 엑셀 컬럼 키 순서에 대응하는 setter 목록을 생성한다.
     *
     * @return 순서가 고정된 setter 목록
     */
    private List<Method> resolveOrderedSetters() {
        if (excelColumnKeys == null || excelColumnKeys.isEmpty()) {
            return List.of();
        }
        final var methods = rowClass.getMethods();
        final var ordered = new ArrayList<Method>(excelColumnKeys.size());
        for (final var fieldKey : excelColumnKeys) {
            final var normalized = AppStringUtils.trimToNull(fieldKey);
            if (normalized == null) {
                throw new IllegalStateException("excelColumnKeys must not contain blank values");
            }
            final var setterName = "set" + Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
            final var setter = Arrays.stream(methods)
                .filter((method) -> method.getName().equals(setterName))
                .filter((method) -> method.getParameterCount() == 1)
                .findFirst()
                .orElseThrow(() ->
                    new IllegalStateException("No setter method found for excel column key: " + normalized)
                );
            ordered.add(setter);
        }
        return List.copyOf(ordered);
    }

    /**
     * CSV 파일을 파싱한다.
     *
     * @param file CSV 파일
     * @return 파싱된 행 목록
     */
    private List<Map<String, String>> parseCsv(MultipartFile file) {
        try {
            final var rows = CsvParser.parse(file.getInputStream());
            return rows.stream().map(csvFieldsMapper).filter(this::hasAnyValue).toList();
        } catch (IOException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_UNSUPPORTED_FORMAT.code());
        }
    }

    /**
     * 행 데이터에 하나 이상의 유효 값이 포함되어 있는지 확인한다.
     *
     * @param row 필드 맵
     * @return 하나라도 비어있지 않은 값이 있으면 true
     */
    private boolean hasAnyValue(Map<String, String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        return row.values().stream().anyMatch(AppStringUtils::isNotBlank);
    }
}
