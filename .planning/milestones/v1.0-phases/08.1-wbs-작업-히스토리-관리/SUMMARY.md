---
phase: 08.1
plan: single
status: done
one_liner: "WBS 문서 연결, 태그 허브, 댓글/활동 히스토리, 개인 TODO 연동을 구현했다."
requirements-completed: [WHM-01, WHM-02, WHM-03, WHM-04, WHM-05, WHM-06, WHM-07, WHM-08]
---

# Phase 8.1 Summary: WBS 작업 히스토리 관리

## Outcome

Phase 8.1 is complete and GSD-reviewed.

The delivered scope covers:

- WBS-context document linking and tag-centric document navigation
- task comments and activity history in the WBS workspace
- personal TODO management with WBS/document linkage and privacy boundaries
- post-review remediation for personal TODO workspace semantics, rollback safety, and SRP cleanup

## Delivered Waves

### Stage 1

- WBS-document links
- markdown/document tags
- project `Tags` tab

### Stage 2

- common work comments
- work activity history
- WBS context comment/activity UI

### Stage 3

- `My Tasks` personal TODO workspace
- TODO-document and TODO-WBS linkage
- privacy boundary enforcement for unlinked vs linked TODOs

### Post-Review Remediation

- `RIS-265`: decoupled personal TODO operations from team edit permission and aligned them to the approved `개인 작업 공간` policy
- `RIS-266`: added rollback/re-sync safety for failed WBS link and unlink mutations in `My Tasks`
- `RIS-267`: split oversized TODO backend/frontend modules to match the repo SRP guidance in `CLAUDE.md`

## Canonical Evidence

- Review: `.planning/phases/08.1-wbs-작업-히스토리-관리/08.1-REVIEWS.md`
- Validation: `.planning/phases/08.1-wbs-작업-히스토리-관리/08.1-VALIDATION.md`
- Verification: `.planning/phases/08.1-wbs-작업-히스토리-관리/08.1-VERIFICATION.md`
- QA checklist/results: `plan/2026-04-28-WBS-작업-히스토리-관리-설계/03-QA-승인-체크리스트.md`

## Follow-up Boundary

Potential future expansion such as richer Gantt risk visualization for linked TODOs should be tracked as a separate follow-up issue, not folded back into 8.1 closeout.
