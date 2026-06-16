package com.smarterd.domain.dictionary.service;

/**
 * 검증 통과 후 저장 후보로 유지하는 용어 행.
 *
 * @param rowNumber 원본 행 번호
 * @param row 저장 후보 용어 행
 */
record ValidatedTermRow(int rowNumber, TermBulkRow row) {}
