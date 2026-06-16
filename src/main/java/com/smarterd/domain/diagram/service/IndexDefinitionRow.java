package com.smarterd.domain.diagram.service;

/**
 * 인덱스 정의서 데이터 행.
 *
 * @param databaseName 영문 DB명
 * @param tableOwner 테이블 소유자
 * @param tableName 테이블명
 * @param indexName 인덱스명
 * @param columnId 컬럼 ID
 * @param order 순서
 * @param remark 비고
 */
record IndexDefinitionRow(
    String databaseName,
    String tableOwner,
    String tableName,
    String indexName,
    String columnId,
    int order,
    String remark
) {}
