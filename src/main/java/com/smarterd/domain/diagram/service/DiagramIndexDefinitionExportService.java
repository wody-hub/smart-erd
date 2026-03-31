package com.smarterd.domain.diagram.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.utils.AppStringUtils;
import com.smarterd.utils.excel.ExcelData;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램의 인덱스 정의서 엑셀 다운로드를 생성한다.
 *
 * <p>현재 다이어그램 모델에서 명시적으로 보존되는 인덱스 메타데이터가 없으므로,
 * PK 컬럼과 FK 컬럼을 기준으로 인덱스 정의서를 파생 생성한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramIndexDefinitionExportService {

    private static final String SHEET_NAME = "인덱스 정의서";
    private static final String TITLE = "인덱스 정의서";
    private static final String PRIMARY_KEY_INDEX_PREFIX = "pk_";
    private static final String FOREIGN_KEY_INDEX_PREFIX = "idx_";
    private static final float TITLE_ROW_HEIGHT = 28F;
    private static final float HEADER_ROW_HEIGHT = 22F;
    private static final List<String> HEADERS = List.of(
        "영문 DB명",
        "테이블 소유자",
        "테이블명",
        "인덱스명",
        "컬럼 ID",
        "순서",
        "비고"
    );
    private static final int[] COLUMN_WIDTHS = { 16 * 256, 16 * 256, 22 * 256, 34 * 256, 20 * 256, 8 * 256, 18 * 256 };

    private final DiagramService diagramService;
    private final ObjectMapper objectMapper;

    /**
     * 인덱스 정의서 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param contentOverride 현재 캔버스 기준 직렬화 JSON (nullable)
     * @return 엑셀 데이터
     */
    public ExcelData generateIndexDefinition(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        @Nullable String contentOverride
    ) {
        final var diagram = diagramService.loadReadableDiagram(loginId, teamId, projectId, diagramId);
        final var content = AppStringUtils.defaultIfBlank(contentOverride, diagram.getContent());
        final var rows = extractRows(diagram, content);
        return buildWorkbook(diagram.getName(), rows);
    }

    /**
     * 다이어그램 JSON에서 인덱스 정의서 행을 추출한다.
     *
     * @param diagram 대상 다이어그램
     * @param content 직렬화된 다이어그램 JSON
     * @return 정의서 행 목록
     */
    private List<IndexDefinitionRow> extractRows(
        com.smarterd.domain.diagram.entity.Diagram diagram,
        @Nullable String content
    ) {
        if (AppStringUtils.isBlank(content)) {
            return List.of();
        }

        try {
            final var rootNode = objectMapper.readTree(content);
            final var nodesNode = rootNode.path("nodes");
            if (!(nodesNode instanceof ArrayNode nodesArray)) {
                return List.of();
            }

            final var exportMetadata = resolveExportMetadata(rootNode);

            final List<IndexDefinitionRow> rows = new ArrayList<>();
            for (final var node : nodesArray) {
                final var dataNode = node.path("data");
                if (!dataNode.isObject()) {
                    continue;
                }

                final var physicalTableName = trimToEmpty(dataNode.path("label"));
                if (physicalTableName.isEmpty()) {
                    continue;
                }

                final List<String> primaryKeyColumns = new ArrayList<>();
                final List<String> foreignKeyColumns = new ArrayList<>();
                final var columnsNode = dataNode.path("columns");
                if (columnsNode instanceof ArrayNode columnsArray) {
                    for (final var columnNode : columnsArray) {
                        final var physicalColumnName = trimToEmpty(columnNode.path("name"));
                        if (physicalColumnName.isEmpty()) {
                            continue;
                        }

                        if (isTrue(columnNode.get("pk"))) {
                            primaryKeyColumns.add(physicalColumnName);
                        }
                        if (isTrue(columnNode.get("fk"))) {
                            foreignKeyColumns.add(physicalColumnName);
                        }
                    }
                }

                appendPrimaryKeyIndexRows(
                    rows,
                    exportMetadata.databaseName(),
                    exportMetadata.tableOwner(),
                    physicalTableName,
                    primaryKeyColumns
                );
                appendForeignKeyIndexRows(
                    rows,
                    exportMetadata.databaseName(),
                    exportMetadata.tableOwner(),
                    physicalTableName,
                    foreignKeyColumns
                );
            }

            return rows;
        } catch (JsonProcessingException exception) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        }
    }

    /**
     * PK 기반 인덱스 행을 추가한다.
     *
     * @param rows 누적 결과
     * @param databaseName 영문 DB명
     * @param ownerLoginId 테이블 소유자
     * @param physicalTableName 테이블명
     * @param primaryKeyColumns PK 컬럼 목록
     */
    private void appendPrimaryKeyIndexRows(
        List<IndexDefinitionRow> rows,
        String databaseName,
        String ownerLoginId,
        String physicalTableName,
        List<String> primaryKeyColumns
    ) {
        if (primaryKeyColumns.isEmpty()) {
            return;
        }

        final var indexName = PRIMARY_KEY_INDEX_PREFIX + physicalTableName;
        for (var columnIndex = 0; columnIndex < primaryKeyColumns.size(); columnIndex++) {
            rows.add(
                new IndexDefinitionRow(
                    databaseName,
                    ownerLoginId,
                    physicalTableName,
                    indexName,
                    primaryKeyColumns.get(columnIndex),
                    columnIndex + 1,
                    ""
                )
            );
        }
    }

    /**
     * FK 기반 인덱스 행을 추가한다.
     *
     * @param rows 누적 결과
     * @param databaseName 영문 DB명
     * @param ownerLoginId 테이블 소유자
     * @param physicalTableName 테이블명
     * @param foreignKeyColumns FK 컬럼 목록
     */
    private void appendForeignKeyIndexRows(
        List<IndexDefinitionRow> rows,
        String databaseName,
        String ownerLoginId,
        String physicalTableName,
        List<String> foreignKeyColumns
    ) {
        for (final var foreignKeyColumn : foreignKeyColumns) {
            rows.add(
                new IndexDefinitionRow(
                    databaseName,
                    ownerLoginId,
                    physicalTableName,
                    FOREIGN_KEY_INDEX_PREFIX + physicalTableName + "_" + foreignKeyColumn,
                    foreignKeyColumn,
                    1,
                    ""
                )
            );
        }
    }

    /**
     * 인덱스 정의서 워크북을 생성한다.
     *
     * @param diagramName 파일명에 사용할 다이어그램 이름
     * @param rows 데이터 행 목록
     * @return 엑셀 데이터
     */
    private ExcelData buildWorkbook(String diagramName, List<IndexDefinitionRow> rows) {
        final var template = DiagramDefinitionWorkbookSupport.createTemplate(
            SHEET_NAME,
            TITLE,
            HEADERS,
            COLUMN_WIDTHS,
            TITLE_ROW_HEIGHT,
            HEADER_ROW_HEIGHT
        );
        final var workbook = template.workbook();
        final var sheet = template.sheet();
        final var bodyStyle = template.bodyStyle();
        final var centeredBodyStyle = template.centeredBodyStyle();

        for (var rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            final var row = sheet.createRow(rowIndex + 2);
            final var indexDefinitionRow = rows.get(rowIndex);
            DiagramDefinitionWorkbookSupport.writeCell(row, 0, indexDefinitionRow.databaseName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 1, indexDefinitionRow.tableOwner(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 2, indexDefinitionRow.tableName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 3, indexDefinitionRow.indexName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 4, indexDefinitionRow.columnId(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 5, indexDefinitionRow.order(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 6, indexDefinitionRow.remark(), bodyStyle);
        }

        return new ExcelData(workbook, AppStringUtils.defaultIfBlank(diagramName, "diagram") + "-index-definition");
    }

    /**
     * JsonNode 문자열 값을 trim한 뒤 반환한다.
     *
     * @param node JSON 노드
     * @return trim된 문자열. 없으면 빈 문자열
     */
    private String trimToEmpty(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        return AppStringUtils.trimToEmpty(node.asText(null));
    }

    private DiagramExportMetadata resolveExportMetadata(JsonNode rootNode) {
        final var metadataNode = rootNode.path("metadata");
        if (!metadataNode.isObject()) {
            return new DiagramExportMetadata("", "");
        }
        return new DiagramExportMetadata(
            trimToEmpty(metadataNode.path("databaseName")),
            trimToEmpty(metadataNode.path("tableOwner"))
        );
    }

    /**
     * JsonNode의 boolean 값을 안전하게 판별한다.
     *
     * @param node JSON 노드
     * @return true면 {@code true}
     */
    private boolean isTrue(@Nullable JsonNode node) {
        return node != null && node.asBoolean(false);
    }

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
    private record IndexDefinitionRow(
        String databaseName,
        String tableOwner,
        String tableName,
        String indexName,
        String columnId,
        int order,
        String remark
    ) {}

    private record DiagramExportMetadata(String databaseName, String tableOwner) {}
}
