# TDD Plan: domain-riskzero-si-review

## RED Cases

| ID | Area | Test File | Expected RED |
|----|------|-----------|--------------|
| DOM-RED-1 | String utility convention | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | direct `isBlank()`/case conversion remains in domain code |
| DOM-RED-2 | Mutable snapshot record | `src/test/java/com/smarterd/domain/diagram/repository/SnapshotWithRevisionTest.java` | constructor/accessor leak `byte[]`, equality is reference-based |
| DOM-RED-3 | Mutable markdown export result | `src/test/java/com/smarterd/domain/markdown/service/MarkdownExportServiceTest.java` | constructor/accessor leak `byte[]`, equality is reference-based |
| DOM-RED-4 | First-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | selected domain services remain above the 300-line threshold |
| DOM-RED-5 | Second-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `AbstractBulkService` remains above the 300-line threshold |
| DOM-RED-6 | Third-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `DomainBulkService` remains above the 300-line threshold |
| DOM-RED-7 | Fourth-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `DiagramSnapshotService` remains above the 300-line threshold |
| DOM-RED-8 | Fifth-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `WbsPlanningService` remains above the 300-line threshold |
| DOM-RED-9 | Sixth-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `TermBulkService` remains above the 300-line threshold |
| DOM-RED-10 | Seventh-pass God-class refactor | `src/test/java/com/smarterd/domain/DomainStandardsTest.java` | `DiagramRoomManager` remains above the 300-line threshold |

## GREEN Verification

- Re-run each focused RED command after implementation.
- Run modified domain support/service tests.
- Run all `com.smarterd.domain.*` tests.
- Compile backend Java sources and tests.
- Run backend documentation and string-utility convention checks.
- Run the full Gradle test suite before completion.

## Commands

```bash
./gradlew test --tests '*DomainStandardsTest.domainCodeUsesAppStringUtilsForStringNormalization'
./gradlew test --tests '*SnapshotWithRevisionTest' --tests '*MarkdownExportServiceTest'
./gradlew test --tests '*DomainStandardsTest.firstPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.secondPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.thirdPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.fourthPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.fifthPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.sixthPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*DomainStandardsTest.seventhPassDomainGodClassTargetsStayBelowThreshold'
./gradlew test --tests '*WordBulkServiceTest'
./gradlew test --tests '*TermBulkServiceTest'
./gradlew test --tests '*DiagramRoomManagerTest'
./gradlew test --tests '*DiagramSnapshotServiceTest'
./gradlew test --tests '*WbsPlanningServiceTest'
./gradlew test --tests '*DomainStandardsTest' --tests '*ProjectServiceTest' --tests '*WordDictionaryExportServiceTest' --tests '*WordService*' --tests '*DomainStartupBackfillServiceTest' --tests '*DiagramIndexDefinitionExportServiceTest' --tests '*AiReadContextServiceTest'
./gradlew test --tests 'com.smarterd.domain.*'
./gradlew compileJava compileTestJava
./scripts/check-string-utils.sh
node scripts/verify-function-docs.mjs --backend-only
./gradlew test --rerun-tasks
```
