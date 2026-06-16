# Implementation Plan: domain-riskzero-si-review

## Status

- Status: implemented
- Scope: `src/main/java/com/smarterd/domain`
- Review source: riskzero-si-review findings for domain layer
- Research: skipped - convention and value-object risk remediation only

## Review Findings

### BE-1. Domain string normalization bypassed project utility rules

- Several domain classes used direct `String#isBlank()` and direct case conversion.
- README requires string validation and normalization to go through `AppStringUtils`.
- A domain-wide standards test is needed because the existing shell check did not catch every direct pattern.

### BE-2. Array-backed domain records leaked mutable byte arrays

- `SnapshotWithRevision` exposed `byte[] ydocSnapshot` directly.
- `MarkdownExportService.MarkdownExportResult` exposed `byte[] body` directly.
- Java record defaults also compare arrays by reference, not content.

### BE-3. Domain contains many large classes

- The domain tree currently has multiple classes above the 300-line God-class threshold.
- This pass did not split those classes because the blast radius is high and should be planned per subdomain.
- The largest candidates are dictionary bulk services, diagram snapshot service, WBS planning/service/dependency services, and diagram room manager.

## Tasks

- Add a domain-wide RED standards test for direct string normalization patterns.
- Replace direct domain `isBlank()` and direct case conversion with `AppStringUtils`.
- Add RED tests for mutable `byte[]` leakage and content-based equality in domain records.
- Add defensive copies and content-based `equals/hashCode` for affected array-backed records.
- Re-run domain-focused tests and README-backed checks.

## Follow-Up Refactoring Batch 1

- Add a RED guard for first-pass God-class targets that must stay at or below 300 source lines.
- Extract project service result records from `ProjectService`:
  - `BusinessOverviewResult`
  - `ProjectResult`
- Extract word dictionary result records from `WordService`:
  - `WordResult`
  - `WordExportResult`
- Extract startup backfill value records from `DomainStartupBackfillService`:
  - `BackfillSummary`
  - `GhContractDomainMetadata`
- Extract index export row data from `DiagramIndexDefinitionExportService`:
  - `IndexDefinitionRow`
- Update API, application tests, and dictionary export support to depend on the new top-level records.

## Follow-Up Result

- First-pass targets now stay below the 300-line threshold:
  - `ProjectService.java`: 278 lines
  - `WordService.java`: 288 lines
  - `DiagramIndexDefinitionExportService.java`: 287 lines
  - `DomainStartupBackfillService.java`: 292 lines

## Follow-Up Refactoring Batch 2

- Add a RED guard for the second-pass God-class target and its extracted support classes.
- Split `AbstractBulkService` into focused dictionary bulk support classes:
  - `BulkFileParsingSupport`: upload file parsing and Excel/CSV row extraction
  - `BulkValidationSessionManager`: validation token issue/consume/resolve
  - `BulkExcelReportSupport`: error report workbook generation
  - `BulkTemplateExcelSupport`: template workbook orchestration
  - `BulkTemplateGuideSheetWriter`: guide sheet writing
  - `BulkTemplateDataSheetStyler`: data sheet styling
  - `BulkTemplateCellStyleFactory`: cell style creation
  - `BulkLogicalNameLookupSupport`: logical-name batch lookup
  - `BulkValidationPreviewSupport`: preview row merge policy
  - `BulkTemplateType`, `BulkMessageResolver`: template/message support contracts
- Update word/term/domain bulk services to use the extracted support types.

## Follow-Up Result Batch 2

- Second-pass targets now stay below the 300-line threshold:
  - `AbstractBulkService.java`: 286 lines
  - `BulkValidationSessionManager.java`: 237 lines
  - `BulkTemplateGuideSheetWriter.java`: 234 lines
  - `BulkTemplateCellStyleFactory.java`: 152 lines
  - `BulkFileParsingSupport.java`: 135 lines
  - `BulkTemplateDataSheetStyler.java`: 86 lines
  - `BulkExcelReportSupport.java`: 73 lines
  - `BulkTemplateType.java`: 58 lines
  - `BulkLogicalNameLookupSupport.java`: 52 lines
  - `BulkTemplateExcelSupport.java`: 46 lines
  - `BulkValidationPreviewSupport.java`: 42 lines
  - `BulkMessageResolver.java`: 19 lines

## Follow-Up Refactoring Batch 3

- Add a RED guard for `DomainBulkService` and all support classes extracted during the split.
- Split `DomainBulkService` domain upload responsibilities into focused support classes:
  - `DomainBulkValidationSupport`: field validation and duplicate validation orchestration
  - `DomainBulkRowParser`: raw row normalization and integer parsing
  - `DomainBulkValidationResultAppender`: preview/error/save-candidate row assembly
  - `DomainBulkExistingNameSupport`: batched existing logical-name lookup
  - `DomainBulkSaveSupport`: entity conversion and save conflict handling
  - `DomainBulkRow`, `ValidatedDomainRow`, `NormalizedDomainRow`: validation/save value objects
  - `DomainBulkValidationResult`, `DomainBulkValidationSession`: validation result/session state
  - `DomainBulkErrorReportRow`, `DomainBulkTemplateRow`: Excel reflection row models

## Follow-Up Result Batch 3

- Third-pass targets now stay below the 300-line threshold:
  - `DomainBulkService.java`: 295 lines
  - `DomainBulkValidationSupport.java`: 245 lines
  - `DomainBulkRowParser.java`: 141 lines
  - `DomainBulkValidationResultAppender.java`: 114 lines
  - `DomainBulkValidationResult.java`: 102 lines
  - `DomainBulkSaveSupport.java`: 87 lines
  - `DomainBulkExistingNameSupport.java`: 69 lines
  - remaining extracted row/session records: 26 lines or less each

## Follow-Up Refactoring Batch 4

- Add a RED guard for `DiagramSnapshotService` and all support classes extracted during the split.
- Split Y.Doc snapshot responsibilities into focused diagram support classes:
  - `DiagramSnapshotCacheSupport`: persisted snapshot cache and lightweight DB projection reads
  - `DiagramSnapshotEncodingSupport`: YLPF encoding, snapshot/update concatenation, snapshot shape logging
  - `DiagramSnapshotPersistenceSupport`: direct snapshot save and client-state replacement flows
  - `DiagramRealtimeSnapshotStateSupport`: after-commit realtime room/cache reconciliation
  - `DiagramSnapshotCompactionSupport`: compaction replacement, cooldown state, warm handoff assembly
  - `DiagramSnapshotFlushSupport`: scheduled/immediate/shutdown dirty update flush
  - `DiagramSnapshotLifecycleSupport`: SmartLifecycle running state and async shutdown callback handling
  - `DiagramSnapshotShutdownFlushResult`: shutdown flush result value object

## Follow-Up Result Batch 4

- Fourth-pass targets now stay below the 300-line threshold:
  - `DiagramSnapshotService.java`: 298 lines
  - `DiagramSnapshotFlushSupport.java`: 212 lines
  - `DiagramSnapshotCompactionSupport.java`: 160 lines
  - `DiagramSnapshotLifecycleSupport.java`: 117 lines
  - `DiagramSnapshotPersistenceSupport.java`: 114 lines
  - `DiagramRealtimeSnapshotStateSupport.java`: 114 lines
  - `DiagramSnapshotCacheSupport.java`: 111 lines
  - `DiagramSnapshotEncodingSupport.java`: 84 lines
  - `DiagramSnapshotShutdownFlushResult.java`: 9 lines

## Follow-Up Refactoring Batch 5

- Add a RED guard for `WbsPlanningService` and all support classes extracted during the split.
- Split WBS planning/template responsibilities into focused support classes while preserving the public service DTO API:
  - `WbsPlanningPayloadJsonSupport`: JSON payload serialization/deserialization
  - `WbsPlanningResultMapper`: WBS item/template summary mapping
  - `WbsPlanningItemFactory`: WBS item creation and validation helpers
  - `WbsPlanningSnapshotSupport`: project WBS snapshot assembly
  - `WbsPlanningInstantiationSupport`: template instantiation flow
  - `WbsPlanningBulkCreateSupport`: bulk item creation flow
  - `WbsParentRef`: parent reference value object

## Follow-Up Result Batch 5

- Fifth-pass targets now stay below the 300-line threshold:
  - `WbsPlanningService.java`: 272 lines
  - `WbsPlanningSnapshotSupport.java`: 213 lines
  - `WbsPlanningItemFactory.java`: 184 lines
  - `WbsPlanningInstantiationSupport.java`: 183 lines
  - `WbsPlanningBulkCreateSupport.java`: 152 lines
  - `WbsPlanningResultMapper.java`: 115 lines
  - `WbsPlanningPayloadJsonSupport.java`: 50 lines
  - `WbsParentRef.java`: 21 lines

## Follow-Up Refactoring Batch 6

- Add a RED guard for `TermBulkService` and all support classes extracted during the split.
- Split term bulk upload responsibilities into focused support classes while preserving the service API and upsert behavior:
  - `TermBulkValidationSupport`: field validation, domain reference validation, duplicate-in-file validation
  - `TermBulkValidationResult`: preview row/result accumulation and response/session conversion
  - `TermBulkSaveSupport`: domain lookup, existing-term lookup, update/create conversion, bulk save
  - `TermBulkRow`, `ValidatedTermRow`: validation/save value objects
  - `TermBulkValidationSession`: validation session payload
  - `TermBulkErrorReportRow`, `TermBulkTemplateRow`: Excel row models

## Follow-Up Result Batch 6

- Sixth-pass targets now stay below the 300-line threshold:
  - `TermBulkService.java`: 279 lines
  - `TermBulkValidationSupport.java`: 269 lines
  - `TermBulkSaveSupport.java`: 142 lines
  - `TermBulkValidationResult.java`: 102 lines
  - `TermBulkValidationSession.java`: 25 lines
  - `TermBulkErrorReportRow.java`: 20 lines
  - `TermBulkTemplateRow.java`: 16 lines
  - `TermBulkRow.java`: 11 lines
  - `ValidatedTermRow.java`: 9 lines

## Follow-Up Refactoring Batch 7

- Add a RED guard for `DiagramRoomManager` and all support classes extracted during the split.
- Split realtime room orchestration responsibilities into focused support classes while preserving the public manager API:
  - `DiagramRoomJoinSupport`: user connection limit, room capacity, session/presence join binding
  - `DiagramRoomLeaveSupport`: wrong-room no-op, session/user cleanup, presence leave, empty-room drain
  - `DiagramRoomBroadcastSupport`: payload copy and synchronized per-session broadcast
  - `DiagramRoomDiscardSupport`: room discard, session close, rate-limit/session resource cleanup
  - `DiagramRoomUpdateSupport`: update append, drain, peek, restore, replace, dirty-id facade

## Follow-Up Result Batch 7

- Seventh-pass targets now stay below the 300-line threshold:
  - `DiagramRoomManager.java`: 200 lines
  - `DiagramRoomLeaveSupport.java`: 180 lines
  - `DiagramRoomUpdateSupport.java`: 159 lines
  - `DiagramRoomJoinSupport.java`: 123 lines
  - `DiagramRoomDiscardSupport.java`: 81 lines
  - `DiagramRoomBroadcastSupport.java`: 66 lines

## Deferred Follow-Up

- Continue splitting remaining domain God classes by subdomain in smaller passes:
  - `dictionary/service/WordBulkService`
  - `pm/wbs/service/WbsService`
  - `pm/wbs/service/WbsDependencyService`
  - `diagram/service/DiagramService`
  - `dictionary/service/DomainService`
  - `pm/issue/service/ProjectIssueService`
  - `diagram/service/DiagramColumnDefinitionExportService`
  - `dictionary/service/TermService`
  - `pm/staffing/service/ProjectStaffingService`
  - `team/service/TeamService`
  - `pm/milestone/service/MilestoneService`
  - `pm/history/service/WorkItemHistoryService`

## Completion Criteria

- RED tests fail before implementation for each implemented risk.
- GREEN tests pass after implementation.
- Domain-focused regression tests pass.
- Java compile passes.
- README-backed string utility and Javadoc/order checks pass.
