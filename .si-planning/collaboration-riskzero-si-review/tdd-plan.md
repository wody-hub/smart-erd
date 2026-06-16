# TDD Plan: collaboration-riskzero-si-review

## RED Cases

| ID | Area | Test File | Expected RED |
|----|------|-----------|--------------|
| COLLAB-RED-1 | Value immutability | `src/test/java/com/smarterd/collaboration/CollaborationValueObjectsTest.java` | `CollaborationSnapshotSaveCommand` exposes mutable `fullStateUpdate` |
| COLLAB-RED-2 | Value immutability | `src/test/java/com/smarterd/collaboration/CollaborationValueObjectsTest.java` | `CollaborationHandoffResult` exposes mutable `snapshot` |
| COLLAB-RED-3 | Value equality | `src/test/java/com/smarterd/collaboration/CollaborationValueObjectsTest.java` | `DocumentCheckpoint` and `PersistedDocument` compare arrays by reference |
| COLLAB-RED-4 | Metadata immutability | `src/test/java/com/smarterd/collaboration/CollaborationValueObjectsTest.java` | `DocumentMetadata.memberIds` can be mutated externally |
| COLLAB-RED-5 | Wire normalization | `src/test/java/com/smarterd/collaboration/CollaborationValueObjectsTest.java` | `ScopeLockMode.fromWireValue` rejects trimmed/case-varied wire values |

## GREEN Verification

```bash
./gradlew test --tests '*CollaborationValueObjectsTest'
./gradlew test --tests '*collaboration*' --tests '*Collaboration*' --tests '*DiagramHandoffSnapshotResponderTest' --tests '*DiagramCollaborationPluginTest' --tests '*PersistDiagramSnapshotUseCaseTest'
./gradlew compileJava compileTestJava
./scripts/check-string-utils.sh
node scripts/verify-function-docs.mjs --backend-only
```
