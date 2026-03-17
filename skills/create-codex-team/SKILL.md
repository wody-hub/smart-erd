---
name: create-codex-team
description: Build a virtual role-based Codex team and orchestrate work by phases for software tasks. Use when users ask for team-style execution, scenario-based planning (`fullstack`, `collab`, `refactor`, `investigate`), phased task boards, or role switching with quality gates.
---

# Create Codex Team

Analyze the request, select a scenario, create a team charter, and execute work as a single Codex agent that switches roles per phase.

## Parse Input

Use this invocation shape:

```text
/create-codex-team <scenario> <task description>
```

- Accept `scenario` as `fullstack`, `collab`, `refactor`, or `investigate`.
- Infer scenario from task text when omitted.
- Treat remaining text as the task description.

## Enforce Core Rules

1. Do not use imaginary multi-agent APIs (for example `TeamCreate`, `TaskCreate`, `TaskUpdate`).
2. Simulate all roles inside one Codex execution.
3. Use `multi_tool_use.parallel` for independent operations.
4. Move phase-by-phase only after `plan -> implement -> verify -> review` gates pass.

## Select Scenario

Use these default mappings when scenario is not provided:

- `fullstack`: feature add, new page, CRUD, implementation request
- `collab`: WebSocket, Yjs, realtime collaboration, CRDT, sync issues
- `refactor`: bug fix, refactor, cleanup, improvement after review
- `investigate`: root-cause analysis, incident investigation, why/how diagnosis

## Build Team Charter And Board

Create this output first:

```markdown
## Team Charter
- Scenario: <fullstack|collab|refactor|investigate>
- Goal:
- Scope:
- Out of Scope:
- Done Definition:

## Task Board
| ID | Phase | Role | Task | Depends On | Status |
|----|-------|------|------|------------|--------|
| T1 | 1 | ... | ... | - | todo |
```

Use status values only: `todo`, `in_progress`, `blocked`, `review`, `done`.

## Apply Scenario Team Structure

Use these role flows:

### fullstack

- Phase 1: `planner-designer` for requirement and flow definition
- Phase 2: `impl-architect` for architecture and task decomposition
- Phase 3: parallel `be-developer` and `fe-developer` implementation
- Phase 4: `reviewer` integration and regression review

### collab

- Phase 1: `collab-developer` for sync path and concurrency stability
- Phase 1 (optional parallel): `be-developer` for non-collab backend support
- Phase 2: `reviewer` for concurrency, integrity, and security checks

### refactor

- Phase 1: parallel `be-developer`, `fe-developer`, optional `collab-developer`
- Phase 2: `reviewer` for impact and regression review

### investigate

- Phase 1: `impl-architect` for reproduction path, root cause, and options

## Switch Roles Explicitly

Use this template whenever changing role:

```text
[ROLE] <role-name>
- Goal:
- Inputs:
- Outputs:
- Done criteria:
```

## Run Parallel Safely

Before parallel execution, verify edits do not target the same file.

1. Parallelize discovery, reads, and independent checks.
2. Parallelize independent validation tasks.
3. Keep dependent edits and ordered validations sequential.
4. Prevent same-file concurrent edits.

## Pass Verification Gates

At the end of each phase, verify:

1. Build or compile succeeds for touched scope (for example `./gradlew compileJava`, `npm run build`).
2. Tests or repro scenario confirms expected behavior.
3. Convention checks pass with project review guides.
4. Impact and rollback points are identified.

## Finalize

After all phases:

1. Mark every task as `done` or `blocked`.
2. Summarize changed files and key diffs.
3. Summarize validation results.
4. List residual risks and next actions.
5. Ask for approval before destructive or release actions (commit/push/PR/deploy).
