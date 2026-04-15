# Phase 1: 마크다운 증분 동기화 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 01-마크다운 증분 동기화
**Areas discussed:** 동기화 전략, Scope Lock 정책, 프리뷰 증분 렌더링, Remote-pending UX

---

## 동기화 전략

| Option | Description | Selected |
|--------|-------------|----------|
| 설계대로 (Recommended) | diff-match-patch로 section 내 변경만 Y.Text에 적용, 경계 넘으면 body-replace fallback | |
| Y.Text 직접 편집 | diff-match-patch 없이 Y.Text API로 직접 insert/delete 조작 | |
| Claude 재량 | 기술적 판단에 맡김 | ✓ |

**User's choice:** Claude 재량
**Notes:** 기술적 최적안 선택을 위임

### Heading 구조 변경 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 전체 재동기화 (Recommended) | section 구조 변경 감지 시 body-replace fallback으로 안전하게 처리 | |
| 증분 재계산 | heading 변경 시 sectionIndex만 재계산하고 증분 적용 유지 | |
| Claude 재량 | 기술적 판단에 맡김 | ✓ |

**User's choice:** Claude 재량

---

## Scope Lock 정책

| Option | Description | Selected |
|--------|-------------|----------|
| CRDT 병합 (Recommended) | Y.Text 문자 단위 CRDT 병합 허용 — 가장 자연스러운 협업 경험 | ✓ |
| Section Lock | 같은 section은 한 사용자만 편집 가능 — 충돌 원천 방지 | |
| Claude 재량 | 기술적 판단에 맡김 | |

**User's choice:** CRDT 병합

---

## 프리뷰 증분 렌더링

| Option | Description | Selected |
|--------|-------------|----------|
| Section HTML 캐시 (Recommended) | 변경된 section만 Worker로 재파싱, 나머지는 캐시된 HTML 유지 | ✓ |
| 가상 스크롤 병행 | section 캐시 + 뷰포트 밖 section은 DOM에서 제거 | |
| Claude 재량 | 기술적 판단에 맡김 | |

**User's choice:** Section HTML 캐시

---

## Remote-pending UX

### 다른 Section 변경 표시

| Option | Description | Selected |
|--------|-------------|----------|
| 자동 수락 (Recommended) | 다른 section 변경은 배너 없이 자동 적용 — 방해 최소화 | ✓ |
| 토스트 알림 | 자동 수락하되 토스트로 "OO님이 Section X 수정" 알림 | |
| Claude 재량 | 기술적 판단에 맡김 | |

**User's choice:** 자동 수락

### 같은 Section 충돌

| Option | Description | Selected |
|--------|-------------|----------|
| 유지 (Recommended) | 기존 remote-pending 3버튼 UI 그대로 사용 | ✓ |
| 단순화 | CRDT 병합만 하고 버튼 UI 없이 자동 처리 | |
| Claude 재량 | 기술적 판단에 맡김 | |

**User's choice:** 유지

---

## Claude's Discretion

- 동기화 구현 방식 (diff-match-patch vs Y.Text 직접 조작)
- Section 구조 변경 시 fallback 전략

## Deferred Ideas

None
