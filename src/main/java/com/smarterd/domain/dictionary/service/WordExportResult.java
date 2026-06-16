package com.smarterd.domain.dictionary.service;

import java.util.List;

/**
 * 단어 사전 엑셀 내보내기 결과.
 *
 * @param dictionarySetName 사전 세트명
 * @param words 정렬된 단어 목록
 */
public record WordExportResult(String dictionarySetName, List<WordResult> words) {}
