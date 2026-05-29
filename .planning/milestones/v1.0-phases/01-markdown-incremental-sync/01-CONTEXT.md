# Phase 1: 마크다운 증분 동기화 - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

마크다운 에디터의 동기화 방식을 전체 문서 교체(delete-all/insert-all)에서 Section 단위 증분 업데이트로 전환한다. 동시에 프리뷰 렌더링도 변경된 Section만 재렌더링하는 증분 방식으로 개선한다.

이 Phase는 기존 마크다운 플러그인 1차 구현(Phase 1~5 완료)과 Phase 6(Frontmatter 안전성), Phase 9-A(비동기 Worker 프리뷰) 위에서 진행된다.

</domain>

<decisions>
## Implementation Decisions

### 동기화 전략
- **D-01:** Claude 재량 — diff-match-patch 또는 Y.Text 직접 조작 중 기술적으로 최적인 방식 선택. 기존 설계 문서에서 diff-match-patch로 제안되어 있으나 최종 판단은 연구/기획 단계에서 확정
- **D-02:** Claude 재량 — heading 추가/삭제로 section 구조가 변경될 때의 처리 전략 (전체 재동기화 fallback vs 증분 재계산)

### Scope Lock 정책
- **D-03:** 같은 section을 두 사용자가 동시 편집할 때 Y.Text CRDT 문자 단위 병합을 허용한다. Section Lock으로 차단하지 않는다.
- **D-04:** 다른 section을 편집하는 사용자 간에는 scope 분리로 독립 동작한다.

### 프리뷰 증분 렌더링
- **D-05:** 변경된 section만 Web Worker로 재파싱/렌더링하고, 나머지 section은 캐시된 HTML을 유지한다 (Section HTML 캐시 전략).
- **D-06:** 기존 Phase 9-A의 비동기 Worker 파이프라인을 확장하여 section 단위 처리를 추가한다.

### Remote-pending UX
- **D-07:** 다른 사용자가 다른 section을 수정한 경우 배너 없이 자동 수락한다 — 방해 최소화.
- **D-08:** 같은 section 충돌 시 기존 remote-pending 3버튼 UI(수락/거절/병합)를 유지한다.

### Claude's Discretion
- 동기화 구현 방식 (diff-match-patch vs Y.Text 직접 조작) — 기술적 최적안 선택
- Section 구조 변경 시 fallback 전략 — 안전성 우선 판단
- Section Index Projector 구현 세부사항 (Y.Map 구조, 갱신 타이밍)
- 프리뷰 캐시 무효화 로직 세부사항

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 마크다운 플러그인 설계
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/00-개요.md` — 플러그인 전체 설계 원칙, 범위, 핵심 결정
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/02-편집-모델.md` — TextInputPipeline, DraftState 상태 머신, 파싱 전략
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/03-플러그인-통합.md` — SPI 매핑, capability 구현
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/08-후속-phase-로드맵.md` — Phase 7(증분 동기화) + Phase 9-B(증분 프리뷰) 상세 구현 범위

### 협업 코어 아키텍처
- `plan/finish/2026-03-25-1153(종료)-다이어그램-동기화-아키텍처-재설계/` — 협업 코어 재설계 (ScopeLock, Channel Plugin 등)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts` — 현재 전체 교체 방식의 mutation applier. 증분 적용으로 수정 대상
- `client/src/collaboration/plugins/markdown/markdown-document-plugin.ts` — 마크다운 플러그인 메인 엔트리
- `client/src/collaboration/core/contracts/document-plugin.ts` — 플러그인 계약 인터페이스
- `client/src/collaboration/core/store/document-store.ts` — 문서 상태 스토어
- `src/main/java/com/smarterd/collaboration/plugin/ScopeResolver.java` — 백엔드 Scope 인터페이스 (확장 대상)

### Established Patterns
- Yjs Y.Text 중심 CRDT (마크다운은 Y.Map이 아닌 Y.Text가 primary)
- DraftState 300ms debounce 파싱 패턴
- Web Worker 기반 비동기 프리뷰 파이프라인 (Phase 9-A에서 구축)
- 코어 수정 제로 원칙 — 플러그인 계약만으로 구현

### Integration Points
- `markdown-yjs-document-adapter.ts` — Y.Doc ↔ 에디터 버퍼 연결 지점 (증분 적용의 핵심 수정 대상)
- `RemotePendingBanner.tsx` — remote-pending UI (section-aware 로직 추가)
- BE `MarkdownScopeResolver.java` (신규) — 백엔드 section scope 해석

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. 기존 설계 문서(`08-후속-phase-로드맵.md`)의 Phase 7 + Phase 9-B 범위를 기반으로 구현.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-markdown-incremental-sync*
*Context gathered: 2026-04-02*
