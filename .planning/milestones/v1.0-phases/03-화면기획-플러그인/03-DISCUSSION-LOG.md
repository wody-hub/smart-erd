# Phase 03: 화면기획-플러그인 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 03-화면기획-플러그인
**Areas discussed:** Closeout 검증 범위, 협업 검증 전략, Export 품질 기준, DomainValidationHook 정책, Artifact 마감 방식

---

## Closeout 검증 범위

| Option | Description | Selected |
|--------|-------------|----------|
| E2E+QA | Playwright smoke/E2E, 수동 QA 체크, validation/verification 문서까지 남겨 v1 마감 근거를 강하게 만든다. | ✓ |
| Smoke 중심 | 핵심 happy path와 export만 빠르게 확인하고 문서화 부담을 줄인다. | |
| 문서 정리 중심 | 이미 구현된 단위 테스트와 코드 근거를 묶어 closeout하고 브라우저 검증은 후속으로 남긴다. | |

**User's choice:** E2E+QA.
**Notes:** Follow-up choices locked test-profile automated E2E plus dev-profile manual browser QA, `03-VALIDATION.md` plus `03-VERIFICATION.md`, and evidence for every SPEC-01 through SPEC-04 requirement.

---

## 협업 검증 전략

| Option | Description | Selected |
|--------|-------------|----------|
| 2계정 핵심 전파 검증 | 두 브라우저 컨텍스트에서 같은 `screen-spec` 문서를 열고, screen/master/instance 변경 전파와 저장/재진입을 확인한다. | |
| 기존 협업 smoke 재사용 + screen-spec 최소 추가 | 기존 협업 smoke는 신뢰하고 screen-spec은 한두 개 변경 전파만 확인한다. | |
| 3계정 충돌/락 검증까지 | 세 컨텍스트에서 scope lock, 동시 편집, remote 상태까지 깊게 확인한다. | ✓ |

**User's choice:** Initially selected 2계정 핵심 전파 검증, then corrected the decision to 3계정 충돌/락 검증까지.
**Notes:** Follow-up choices require the full editing flow: screen creation/rename, master create/update/delete, instance placement/move/resize, save/re-entry, and scope lock. Pass/fail is UX-strict: propagation delay, missing lock indicator, or remote-state display problems count as failures.

---

## Export 품질 기준

| Option | Description | Selected |
|--------|-------------|----------|
| 파일+내용 sanity | 다운로드 성공뿐 아니라 파일명, 크기, 페이지 수/PDF 생성, 빈 이미지 방지, 화면 요소 표시까지 확인한다. | ✓ |
| 다운로드 성공 중심 | PNG/PDF 버튼이 동작하고 파일이 생성되는지만 확인한다. | |
| 시각 품질까지 엄격히 | 폰트, 배율, 잘림, 여백, 다중 화면 PDF 페이지 구성을 눈으로 확인하고 기록한다. | |

**User's choice:** 파일+내용 sanity.
**Notes:** Follow-up choices selected Playwright automatic download inspection as the primary check. PNG and PDF are both mandatory; if either fails, SPEC-04 remains incomplete.

---

## DomainValidationHook 정책

| Option | Description | Selected |
|--------|-------------|----------|
| no-op 유지 명시 | v1에서는 협업 mutation/scope와 FE 문서 모델 검증을 신뢰하고 BE `DomainValidationHook`은 의도적으로 no-op으로 유지한다. | ✓ |
| 최소 구조 검증 추가 | BE에서 screen/master/instance 필수 shape와 참조 무결성 정도를 검증한다. | |
| 검증 설계만 남김 | 이번 Phase 3에서는 구현하지 않고 후속 phase/backlog로 강화 설계를 남긴다. | |

**User's choice:** no-op 유지 명시.
**Notes:** The user asked what no-op means before deciding. The final safety guard is documentation plus test evidence only: no code TODO, no backlog item, and no backend structure-validation implementation in this closeout phase.

---

## Artifact 마감 방식

| Option | Description | Selected |
|--------|-------------|----------|
| CONTEXT -> PLAN -> VALIDATION/VERIFICATION | `03-CONTEXT.md`를 만들고, 다음 `$gsd-plan-phase 3`에서 plan을 만든 뒤 execution 결과로 validation/verification을 남긴다. | ✓ |
| VALIDATION/VERIFICATION 직접 작성 | 별도 plan 없이 바로 검증 문서를 작성하고 Phase 3을 마감한다. | |
| 기존 SUMMARY 중심 갱신 | 현재 `SUMMARY.md`를 정본으로 업데이트하고 검증 결과만 간단히 추가한다. | |

**User's choice:** CONTEXT -> PLAN -> VALIDATION/VERIFICATION.
**Notes:** Existing `SUMMARY.md` should be updated after closeout into the final Phase 3 summary and should link to `03-VALIDATION.md` and `03-VERIFICATION.md` as canonical evidence.

---

## the agent's Discretion

- The planner may choose the final Playwright spec organization and helper extraction.
- The planner may choose exact test data setup as long as test-profile automation and dev-profile QA are both documented.
- The planner may choose equivalent PDF structural validation if direct page-count inspection is impractical in the available test runtime.

## Deferred Ideas

None — discussion stayed within phase scope.
