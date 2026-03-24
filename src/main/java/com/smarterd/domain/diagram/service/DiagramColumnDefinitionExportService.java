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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램의 컬럼 정의서 엑셀 다운로드를 생성한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramColumnDefinitionExportService {

    private static final String SHEET_NAME = "컬럼 정의서";
    private static final String TITLE = "컬럼 정의서";
    private static final String DEFAULT_FLAG_YES = "Y";
    private static final String DEFAULT_FLAG_NO = "N";
    private static final String AUTO_INCREMENT_CONSTRAINT = "AUTO_INCREMENT";
    private static final float TITLE_ROW_HEIGHT = 28F;
    private static final float HEADER_ROW_HEIGHT = 28F;
    private static final List<String> HEADERS = List.of(
        "NO",
        "영문 테이블명",
        "한글 컬럼명",
        "영문 컬럼명",
        "컬럼설명",
        "연관 엔터티명",
        "연관 속성명",
        "데이터타입",
        "데이터 길이",
        "Not Null 여부",
        "PK정보\n(Primary Key)",
        "AK정보\n(Alternate Key)",
        "FK정보\n(Foreign Key)",
        "제약조건",
        "개인정보 여부",
        "암호화 여부",
        "공개/비공개 여부",
        "비고"
    );
    private static final int[] COLUMN_WIDTHS = {
        8 * 256,
        18 * 256,
        18 * 256,
        18 * 256,
        24 * 256,
        22 * 256,
        16 * 256,
        12 * 256,
        12 * 256,
        12 * 256,
        14 * 256,
        12 * 256,
        20 * 256,
        16 * 256,
        12 * 256,
        12 * 256,
        14 * 256,
        16 * 256
    };
    private static final String HANDLE_SUFFIX_PATTERN = "-(?:source|target)(?:-(?:left|right))?$";

    private final DiagramService diagramService;
    private final ObjectMapper objectMapper;

    /**
     * 컬럼 정의서 엑셀을 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param diagramId 다이어그램 ID
     * @param contentOverride 현재 캔버스 기준 직렬화 JSON (nullable)
     * @return 엑셀 데이터
     */
    public ExcelData generateColumnDefinition(
        String loginId,
        Long teamId,
        Long projectId,
        Long diagramId,
        @Nullable String contentOverride
    ) {
        final var diagram = diagramService.loadReadableDiagram(loginId, teamId, projectId, diagramId);
        final var content = AppStringUtils.defaultIfBlank(contentOverride, diagram.getContent());
        final var rows = extractRows(content);
        return buildWorkbook(diagram.getName(), rows);
    }

    /**
     * 다이어그램 JSON에서 컬럼 정의서 행을 추출한다.
     *
     * @param content 직렬화된 다이어그램 JSON
     * @return 정의서 행 목록
     */
    private List<ColumnDefinitionRow> extractRows(@Nullable String content) {
        if (AppStringUtils.isBlank(content)) {
            return List.of();
        }

        try {
            final var rootNode = objectMapper.readTree(content);
            final var nodesNode = rootNode.path("nodes");
            if (!(nodesNode instanceof ArrayNode nodesArray)) {
                return List.of();
            }

            final var tablesByNodeId = new LinkedHashMap<String, TableSnapshot>();
            for (final var node : nodesArray) {
                final var nodeId = trimToEmpty(node.path("id"));
                final var dataNode = node.path("data");
                if (nodeId.isEmpty() || !dataNode.isObject()) {
                    continue;
                }

                final var physicalTableName = trimToEmpty(dataNode.path("label"));
                if (physicalTableName.isEmpty()) {
                    continue;
                }

                final var logicalTableName = AppStringUtils.defaultIfBlank(
                    trimToEmpty(dataNode.path("logicalTableName")),
                    physicalTableName
                );
                final List<ColumnSnapshot> columns = new ArrayList<>();
                final var columnsNode = dataNode.path("columns");
                if (columnsNode instanceof ArrayNode columnsArray) {
                    for (final var columnNode : columnsArray) {
                        final var columnId = trimToEmpty(columnNode.path("id"));
                        final var physicalColumnName = trimToEmpty(columnNode.path("name"));
                        if (columnId.isEmpty() || physicalColumnName.isEmpty()) {
                            continue;
                        }

                        final var logicalColumnName = AppStringUtils.defaultIfBlank(
                            trimToEmpty(columnNode.path("logicalName")),
                            physicalColumnName
                        );
                        final var type = trimToEmpty(columnNode.path("type"));
                        columns.add(
                            new ColumnSnapshot(
                                columnId,
                                physicalColumnName,
                                logicalColumnName,
                                type,
                                booleanOrNull(columnNode.get("nullable")),
                                booleanOrNull(columnNode.get("pk")),
                                booleanOrNull(columnNode.get("fk")),
                                booleanOrNull(columnNode.get("autoIncrement"))
                            )
                        );
                    }
                }

                tablesByNodeId.put(
                    nodeId,
                    new TableSnapshot(
                        nodeId,
                        physicalTableName,
                        logicalTableName,
                        columns
                    )
                );
            }

            final var fkInfoByColumnKey = buildFkInfoByColumnKey(rootNode.path("edges"), tablesByNodeId);
            final List<ColumnDefinitionRow> rows = new ArrayList<>();
            var index = 1;
            for (final var table : tablesByNodeId.values()) {
                for (final var column : table.columns()) {
                    rows.add(
                        new ColumnDefinitionRow(
                            index++,
                            table.physicalTableName(),
                            column.logicalColumnName(),
                            column.physicalColumnName(),
                            column.logicalColumnName(),
                            table.logicalTableName(),
                            column.logicalColumnName(),
                            extractBaseType(column.type()),
                            extractTypeLength(column.type()),
                            formatNotNullFlag(column.nullable()),
                            Boolean.TRUE.equals(column.pk()) ? column.physicalColumnName() : "",
                            "",
                            AppStringUtils.defaultIfBlank(
                                fkInfoByColumnKey.get(buildColumnKey(table.nodeId(), column.columnId())),
                                ""
                            ),
                            Boolean.TRUE.equals(column.autoIncrement()) ? AUTO_INCREMENT_CONSTRAINT : "",
                            "",
                            "",
                            "",
                            ""
                        )
                    );
                }
            }

            return rows;
        } catch (JsonProcessingException exception) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_CONTENT_INVALID_JSON.code());
        }
    }

    /**
     * FK 정보를 컬럼 키별로 계산한다.
     *
     * @param edgesNode 엣지 JSON
     * @param tablesByNodeId 테이블 스냅샷 맵
     * @return 컬럼 키 -> FK 정보
     */
    private Map<String, String> buildFkInfoByColumnKey(
        JsonNode edgesNode,
        Map<String, TableSnapshot> tablesByNodeId
    ) {
        final Map<String, String> fkInfoByColumnKey = new LinkedHashMap<>();
        if (!(edgesNode instanceof ArrayNode edgesArray)) {
            return fkInfoByColumnKey;
        }

        for (final var edgeNode : edgesArray) {
            final var sourceNodeId = trimToEmpty(edgeNode.path("source"));
            final var targetNodeId = trimToEmpty(edgeNode.path("target"));
            final var sourceHandle = trimToEmpty(edgeNode.path("sourceHandle"));
            final var targetHandle = trimToEmpty(edgeNode.path("targetHandle"));
            if (sourceNodeId.isEmpty() || targetNodeId.isEmpty() || sourceHandle.isEmpty() || targetHandle.isEmpty()) {
                continue;
            }

            final var sourceTable = tablesByNodeId.get(sourceNodeId);
            final var targetTable = tablesByNodeId.get(targetNodeId);
            if (sourceTable == null || targetTable == null) {
                continue;
            }

            final var sourceColumnId = extractColumnId(sourceHandle, sourceNodeId);
            final var targetColumnId = extractColumnId(targetHandle, targetNodeId);
            final var sourceColumn = sourceTable.findColumn(sourceColumnId);
            if (sourceColumn == null) {
                continue;
            }

            fkInfoByColumnKey.put(
                buildColumnKey(targetNodeId, targetColumnId),
                sourceTable.physicalTableName() + "." + sourceColumn.physicalColumnName()
            );
        }

        return fkInfoByColumnKey;
    }

    /**
     * 컬럼 정의서 워크북을 생성한다.
     *
     * @param diagramName 파일명에 사용할 다이어그램 이름
     * @param rows 데이터 행 목록
     * @return 엑셀 데이터
     */
    private ExcelData buildWorkbook(String diagramName, List<ColumnDefinitionRow> rows) {
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
            final var columnDefinitionRow = rows.get(rowIndex);
            DiagramDefinitionWorkbookSupport.writeCell(row, 0, columnDefinitionRow.no(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 1, columnDefinitionRow.physicalTableName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 2, columnDefinitionRow.logicalColumnName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 3, columnDefinitionRow.physicalColumnName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 4, columnDefinitionRow.columnDescription(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 5, columnDefinitionRow.relatedEntityName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 6, columnDefinitionRow.relatedAttributeName(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 7, columnDefinitionRow.dataType(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 8, columnDefinitionRow.dataLength(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 9, columnDefinitionRow.notNullFlag(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 10, columnDefinitionRow.pkInfo(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 11, columnDefinitionRow.akInfo(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 12, columnDefinitionRow.fkInfo(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 13, columnDefinitionRow.constraintInfo(), bodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 14, columnDefinitionRow.personalInfoFlag(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 15, columnDefinitionRow.encryptedFlag(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 16, columnDefinitionRow.visibilityFlag(), centeredBodyStyle);
            DiagramDefinitionWorkbookSupport.writeCell(row, 17, columnDefinitionRow.remark(), bodyStyle);
        }

        return new ExcelData(
            workbook,
            AppStringUtils.defaultIfBlank(diagramName, "diagram") + "-column-definition"
        );
    }

    private String extractColumnId(String handleId, String nodeId) {
        return handleId.replace(nodeId + "-", "").replaceFirst(HANDLE_SUFFIX_PATTERN, "");
    }

    private String buildColumnKey(String nodeId, String columnId) {
        return nodeId + "::" + columnId;
    }

    private String extractBaseType(String rawType) {
        final var trimmed = AppStringUtils.defaultIfBlank(rawType, "").trim();
        if (trimmed.isEmpty()) {
            return "";
        }

        final var openParenIndex = trimmed.indexOf('(');
        if (openParenIndex < 0) {
            return trimmed;
        }
        return trimmed.substring(0, openParenIndex).trim();
    }

    private String extractTypeLength(String rawType) {
        final var trimmed = AppStringUtils.defaultIfBlank(rawType, "").trim();
        final var openParenIndex = trimmed.indexOf('(');
        final var closeParenIndex = trimmed.lastIndexOf(')');
        if (openParenIndex < 0 || closeParenIndex <= openParenIndex) {
            return "";
        }
        return trimmed.substring(openParenIndex + 1, closeParenIndex).trim();
    }

    private String formatNotNullFlag(@Nullable Boolean nullable) {
        if (nullable == null) {
            return "";
        }
        return Boolean.TRUE.equals(nullable) ? DEFAULT_FLAG_NO : DEFAULT_FLAG_YES;
    }

    private Boolean booleanOrNull(@Nullable JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return node.asBoolean();
    }

    private String trimToEmpty(JsonNode node) {
        if (node == null || node.isNull()) {
            return "";
        }
        return AppStringUtils.defaultIfBlank(node.asText(null), "").trim();
    }

    private record TableSnapshot(
        String nodeId,
        String physicalTableName,
        String logicalTableName,
        List<ColumnSnapshot> columns
    ) {
        private ColumnSnapshot findColumn(String columnId) {
            return columns.stream()
                .filter(column -> column.columnId().equals(columnId))
                .findFirst()
                .orElse(null);
        }
    }

    private record ColumnSnapshot(
        String columnId,
        String physicalColumnName,
        String logicalColumnName,
        String type,
        @Nullable Boolean nullable,
        @Nullable Boolean pk,
        @Nullable Boolean fk,
        @Nullable Boolean autoIncrement
    ) {}

    private record ColumnDefinitionRow(
        int no,
        String physicalTableName,
        String logicalColumnName,
        String physicalColumnName,
        String columnDescription,
        String relatedEntityName,
        String relatedAttributeName,
        String dataType,
        String dataLength,
        String notNullFlag,
        String pkInfo,
        String akInfo,
        String fkInfo,
        String constraintInfo,
        String personalInfoFlag,
        String encryptedFlag,
        String visibilityFlag,
        String remark
    ) {}
}
