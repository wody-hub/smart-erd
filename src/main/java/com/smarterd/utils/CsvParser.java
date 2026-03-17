package com.smarterd.utils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * CSV 파일 파싱 유틸리티.
 *
 * <p>UTF-8 BOM을 자동 감지하여 제거하고, 큰따옴표로 감싸진 필드 내 쉼표를 올바르게 처리한다.
 * 첫 줄(헤더)은 제외하고 데이터 행만 반환한다.</p>
 */
public final class CsvParser {

    private static final char BOM = '\uFEFF';

    private CsvParser() {}

    /**
     * CSV 파일을 파싱하여 행별 문자열 배열을 반환한다. 첫 줄(헤더)은 제외.
     *
     * @param inputStream CSV 파일 입력 스트림
     * @return 데이터 행 목록 (각 행은 필드 문자열 배열)
     * @throws IOException 파일 읽기 오류 발생 시
     */
    public static List<String[]> parse(InputStream inputStream) throws IOException {
        final var rows = new ArrayList<String[]>();
        try (final var reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            var firstLine = true;
            String line;
            var pendingLine = new StringBuilder();
            while ((line = reader.readLine()) != null) {
                if (firstLine) {
                    // BOM 제거
                    if (!line.isEmpty() && line.charAt(0) == BOM) {
                        line = line.substring(1);
                    }
                    firstLine = false;
                    continue; // 헤더 건너뜀
                }

                // 멀티라인 필드 처리: 이전 줄에서 큰따옴표가 열린 상태이면 현재 줄을 이어 붙임
                if (!pendingLine.isEmpty()) {
                    pendingLine.append('\n').append(line);
                    if (isQuoteClosed(pendingLine.toString())) {
                        rows.add(parseLine(pendingLine.toString()));
                        pendingLine.setLength(0);
                    }
                    continue;
                }

                if (AppStringUtils.isBlank(line)) {
                    continue;
                }

                if (!isQuoteClosed(line)) {
                    pendingLine.append(line);
                    continue;
                }
                rows.add(parseLine(line));
            }
            // 파일 끝에 닫히지 않은 큰따옴표가 남은 경우 — 남은 데이터를 최선의 노력으로 파싱
            if (!pendingLine.isEmpty()) {
                rows.add(parseLine(pendingLine.toString()));
            }
        }
        return rows;
    }

    /**
     * 큰따옴표가 짝이 맞는지(닫힌 상태인지) 확인한다.
     * 이스케이프된 큰따옴표({@code ""})를 고려하여 홀수 개의 큰따옴표가 남으면 열린 상태로 판단한다.
     *
     * @param line 확인할 문자열
     * @return 큰따옴표가 짝이 맞으면 true, 열린 상태이면 false
     */
    private static boolean isQuoteClosed(String line) {
        var quoteCount = 0;
        for (var i = 0; i < line.length(); i++) {
            if (line.charAt(i) == '"') {
                quoteCount++;
            }
        }
        return quoteCount % 2 == 0;
    }

    /**
     * CSV 헤더(첫 줄)를 파싱하여 필드 배열로 반환한다.
     *
     * @param inputStream CSV 파일 입력 스트림
     * @return 헤더 필드 배열, 빈 파일이면 빈 배열
     * @throws IOException 파일 읽기 오류 발생 시
     */
    public static String[] parseHeader(InputStream inputStream) throws IOException {
        try (final var reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            var headerLine = reader.readLine();
            if (headerLine == null) {
                return new String[0];
            }
            // BOM 제거
            if (!headerLine.isEmpty() && headerLine.charAt(0) == BOM) {
                headerLine = headerLine.substring(1);
            }
            return parseLine(headerLine);
        }
    }

    /**
     * 한 줄의 CSV 데이터를 파싱하여 필드 배열로 반환한다.
     *
     * <p>큰따옴표로 감싸진 필드 내의 쉼표와 이스케이프된 큰따옴표({@code ""})를 처리한다.</p>
     *
     * @param line CSV 행 문자열
     * @return 필드 문자열 배열
     */
    private static String[] parseLine(String line) {
        final var fields = new ArrayList<String>();
        final var sb = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.length(); i++) {
            final var c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    // 연속 큰따옴표는 이스케이프
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        sb.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    sb.append(c);
                }
            } else {
                if (c == '"') {
                    inQuotes = true;
                } else if (c == ',') {
                    fields.add(sanitize(AppStringUtils.trimToEmpty(sb.toString())));
                    sb.setLength(0);
                } else {
                    sb.append(c);
                }
            }
        }
        fields.add(sanitize(AppStringUtils.trimToEmpty(sb.toString())));

        return fields.toArray(new String[0]);
    }

    /**
     * CSV Injection을 방지하기 위해 위험 접두사 문자를 제거한다.
     *
     * <p>셀 값이 {@code =}, {@code +}, {@code -}, {@code @}, {@code \t}, {@code \r}로 시작하면
     * Excel에서 수식으로 해석될 수 있으므로, 해당 접두사 문자를 반복 제거한다.</p>
     *
     * @param value 원본 셀 값
     * @return 위험 접두사가 제거된 안전한 값
     */
    private static String sanitize(String value) {
        if (AppStringUtils.isBlank(value)) {
            return value;
        }
        // 음수 숫자 패턴 (예: "-123", "-45.6")은 sanitize하지 않음
        if (isNegativeNumber(value)) {
            return value;
        }
        var sanitized = value;
        while (!sanitized.isEmpty() && isDangerousPrefix(sanitized.charAt(0))) {
            sanitized = sanitized.substring(1);
        }
        return sanitized;
    }

    /**
     * 음수 숫자 패턴인지 확인한다 (예: "-123", "-45.6").
     *
     * @param value 확인할 문자열
     * @return 음수 숫자 패턴이면 true
     */
    private static boolean isNegativeNumber(String value) {
        if (value.length() < 2 || value.charAt(0) != '-') {
            return false;
        }
        return Character.isDigit(value.charAt(1));
    }

    /**
     * CSV Injection 위험 접두사 문자인지 확인한다.
     *
     * @param c 확인할 문자
     * @return 위험 접두사 여부
     */
    private static boolean isDangerousPrefix(char c) {
        return c == '=' || c == '+' || c == '-' || c == '@' || c == '\t' || c == '\r';
    }
}
