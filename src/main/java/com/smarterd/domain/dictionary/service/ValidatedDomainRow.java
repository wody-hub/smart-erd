package com.smarterd.domain.dictionary.service;

/**
 * 검증 통과 후 저장 후보로 유지하는 도메인 행.
 *
 * @param rowNumber 원본 행 번호
 * @param row 저장 후보 도메인 행
 */
record ValidatedDomainRow(int rowNumber, DomainBulkRow row) {}
