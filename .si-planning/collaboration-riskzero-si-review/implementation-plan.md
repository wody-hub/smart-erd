# Implementation Plan: collaboration-riskzero-si-review

## Status

- Status: implemented
- Scope: `src/main/java/com/smarterd/collaboration`
- Review source: riskzero-si-review findings for collaboration framework
- Research: skipped - convention and value-object risk remediation only

## Review Findings

### BE-1. Mutable arrays leak from collaboration value records

- `CollaborationSnapshotSaveCommand` and `CollaborationHandoffResult` exposed `byte[]` components directly.
- Mutation after construction or through accessors could alter supposedly immutable command/result records.

### BE-2. Array-backed records used reference-based equality

- `DocumentCheckpoint`, `PersistedDocument`, `CollaborationSnapshotSaveCommand`, and `CollaborationHandoffResult` used Java record default equality for `byte[]`.
- Record equality compared array references instead of snapshot contents.

### BE-3. Mutable member set leaks from metadata

- `DocumentMetadata.memberIds` accepted and returned a caller-owned mutable `Set`.
- Changes outside the record could alter authorization metadata.

### BE-4. External scope lock wire value lacked standard normalization

- `ScopeLockMode.fromWireValue` consumed external JSON/WS input without the project-standard `AppStringUtils` normalization path.

## Tasks

- Add RED tests for byte-array defensive copy behavior.
- Add RED tests for content-based equality/hash code on array-backed collaboration records.
- Add RED tests for defensive copying of `DocumentMetadata.memberIds`.
- Add RED tests for normalized scope lock wire values.
- Implement defensive copies, immutable collection copies, and content-based `equals/hashCode`.
- Re-run collaboration-focused tests and project convention checks.

## Completion Criteria

- RED tests fail before implementation for the reviewed risks.
- GREEN tests pass after implementation.
- Collaboration-focused regression tests pass.
- Java compile passes.
- README-backed string utility and Javadoc/order checks pass.
