# Implementation Plan: application-riskzero-si-review

## Status

- Status: implemented
- Scope: `src/main/java/com/smarterd/application`
- Review source: riskzero-si-review findings for application layer
- Research: skipped - convention and risk remediation only

## Tasks

### BE-1. Keep external AI provider execution outside DB transactions

- Add a regression test proving `AiExecutionGateway.execute` is not method-transactional.
- Remove the write transaction boundary from provider orchestration.
- Keep audit/proposal persistence transactional in their owning services.

### BE-2. Drain provider process stdout and stderr concurrently

- Add a process-launcher regression test that writes enough stdout/stderr to block if streams are not drained.
- Start stdout/stderr readers before writing stdin and waiting for the process.
- Return collected stderr in `ProcessLauncher.Result`.

### BE-3. Enforce shared string normalization utilities

- Add an application-level standards test that blocks direct normalization patterns in application code.
- Use `AppStringUtils` for blank checks and lower/upper-case normalization.
- Extend README utility documentation for the new helpers.

### BE-4. Align transaction conventions in AI services

- Add an application-level standards test for class-level read-only defaults and method-level write overrides.
- Apply `@Transactional(readOnly = true)` at service class level where reads dominate.
- Keep write methods explicitly annotated with `@Transactional`.

### BE-5. Split large application classes

- Add an application-level standards test that fails for application classes over the agreed threshold.
- Extract read-context collectors/formatters from `AiReadContextService`.
- Extract chat view/command/context records from `AiChatExecutionService` and `AiChatContextResolver`.
- Extract history view records from `AiProjectHistoryService`.
- Extract proposal JSON support and create command from `AiActionProposalService`.

## File Placement

- Modified application services under `src/main/java/com/smarterd/application/ai`.
- New application helper/view records are colocated with the package they support.
- Application standards tests live in `src/test/java/com/smarterd/application`.
- Focused regression tests live beside their existing package tests.

## Completion Criteria

- RED tests were observed failing for each risk area before implementation.
- GREEN tests pass for focused regression coverage.
- `compileJava compileTestJava` passes.
- `scripts/check-string-utils.sh` passes.
- `scripts/verify-function-docs.mjs --backend-only` passes.
