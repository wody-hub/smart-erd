---
phase: 01-markdown-incremental-sync
verified: 2026-04-02T23:45:00Z
status: passed
score: 10/10 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed:
    - "applySectionUpdate가 sectionId 기반 경계 재계산 수행 (절대 offset 밀림 방지)"
    - "RemotePendingBanner가 MarkdownDocumentPage에서 렌더링되고 activeSectionId 전달"
    - "computeSectionBoundaries가 fenced code block 내 # 문자를 heading으로 오탐하지 않음"
    - "SectionPreviewCache가 stale section 캐시를 GC 처리"
    - "MarkdownScopeResolver가 잘못된 payload를 document root scope로 fallback"
  gaps_remaining: []
  regressions: []
gaps: []
---

# Phase 01: Markdown Incremental Sync Verification Report

**Phase Goal:** 마크다운 에디터에서 두 사용자가 같은 문서를 동시에 편집할 때 Section 단위로 효율적으로 동기화되고, 변경된 Section만 프리뷰가 재렌더링된다
**Verified:** 2026-04-02T23:45:00Z
**Status:** passed
**Re-verification:** Yes -- cross-AI review gap closure (plans 01-05, 01-06, 01-07)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Section 경계 계산 순수 함수가 heading 기반으로 올바르게 section을 분할한다 | VERIFIED | `markdown-section-index.ts` 216줄, `computeSectionBoundaries` + `findAffectedSection` export, slug 기반 ID, 18개 테스트 |
| 2 | 단일 section 변경 시 `markdown:section-update` 커맨드 발행, heading 추가/삭제/경계 초과 시 `markdown:body-replace` fallback | VERIFIED | `markdown-section-projector.ts` line 34 `buildSectionCommands`, `use-markdown-document-session.ts` line 411 호출 |
| 3 | diff-match-patch 기반 Y.Text 증분 적용이 section 범위 한정으로 동작한다 | VERIFIED | `markdown-yjs-document-adapter.ts` line 173 `applySectionUpdate` -- sectionId 기반 `computeSectionBoundaries` 재계산 + `doc.transact()` 내 diff 적용 |
| 4 | 백엔드에서 `markdown:section-update` 커맨드가 `section/{id}` EXCLUSIVE scope로 해석된다 | VERIFIED | `MarkdownScopeResolver.java` line 41-57 switch case, `ScopeRef("section", sid, EXCLUSIVE)` |
| 5 | MutationApplier가 `markdown:section-update`를 `applySectionUpdate` 경로로 처리한다 | VERIFIED | `markdown-document-mutation-applier.ts` line 21-22 + line 54 `this.documentAdapter.applySectionUpdate(doc, sectionId, sectionText, origin)` |
| 6 | 원격 section-update가 다른 section이면 자동 수락(D-07), 같은 section이면 3버튼 UI(D-08) | VERIFIED | `RemotePendingBanner.tsx` line 54-57 `isAutoAcceptTarget`, line 59-63 useEffect 자동 수락, line 66-68 return null |
| 7 | 변경된 section만 Worker에 재렌더링 요청하고 나머지 HTML은 캐시 유지 | VERIFIED | `SectionPreviewCache` + `useMarkdownSectionPreview`, section별 requestId Map, `MarkdownDocumentPage.tsx` line 106 |
| 8 | [GAP-FIX] applySectionUpdate가 sectionId 기반 경계 재계산 수행 (절대 offset 밀림 방지) | VERIFIED | `markdown-yjs-document-adapter.ts` line 181 `computeSectionBoundaries(currentBody)`, line 182 `boundaries.find(b => b.id === sectionId)`. commit `96b864b` |
| 9 | [GAP-FIX] computeSectionBoundaries가 fenced code block 내 # 문자를 heading으로 오탐하지 않는다 | VERIFIED | `markdown-section-index.ts` line 24 `FENCE_PATTERN`, line 33-64 `findFencedCodeRanges()`, line 82-85 `insideFence` 필터링. 테스트 5건 추가 (총 18건). commit `753dcce` |
| 10 | [GAP-FIX] SectionPreviewCache가 stale section 캐시를 GC 처리한다 | VERIFIED | `markdown-section-preview-cache.ts` line 37-44: `updateSectionOrder` 내 `activeIds` Set 기반 stale 키 삭제. commit `4637fe3` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/lib/markdown-section-index.ts` | SectionBoundary + computeSectionBoundaries + findAffectedSection + fenced code block skip | VERIFIED | 216줄, slug 기반 ID, 한글 지원, FENCE_PATTERN + findFencedCodeRanges |
| `client/src/lib/incremental-text-update.ts` | applyIncrementalTextUpdate | VERIFIED | 39줄, diff-match-patch + Y.Text 증분 적용 |
| `client/src/collaboration/plugins/markdown/markdown-section-projector.ts` | buildSectionCommands + SectionCommand | VERIFIED | 95줄, 구조 변경 감지 + 단일 section 식별 |
| `client/src/lib/markdown-section-preview-cache.ts` | SectionPreviewCache + stale GC | VERIFIED | 84줄, htmlCache Map + sectionOrder + GC in updateSectionOrder |
| `client/src/hooks/useMarkdownSectionPreview.ts` | useMarkdownSectionPreview | VERIFIED | 174줄, section별 requestId Map, Worker fallback, 300ms debounce |
| `client/src/collaboration/yjs/markdown-yjs-document-adapter.ts` | applySectionUpdate (sectionId 기반 경계 재계산) | VERIFIED | line 173-209, computeSectionBoundaries import + 호출, sectionId 기반 target 탐색 |
| `client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts` | section-update -> applySectionUpdate (sectionId 기반) | VERIFIED | line 46-60, sectionId + sectionText payload 검증 후 applySectionUpdate 호출 |
| `client/src/pages/document/use-markdown-document-session.ts` | setEditorBuffer section-aware + activeSectionId + remoteMutation | VERIFIED | line 411 buildSectionCommands, line 416-420 activeSectionId, line 144-151 원격 변경 감지 |
| `client/src/components/collaboration/RemotePendingBanner.tsx` | activeSectionId prop + D-07 자동 수락 + D-08 배너 | VERIFIED | line 29 activeSectionId, line 54-57 isAutoAcceptTarget, line 59-68 자동 수락/null |
| `client/src/pages/document/MarkdownDocumentPage.tsx` | useMarkdownSectionPreview + RemotePendingBanner 렌더링 | VERIFIED | line 22 useMarkdownSectionPreview, line 106 호출, line 11 RemotePendingBanner, line 232-237 JSX with activeSectionId |
| `client/src/lib/markdown-preview-worker.ts` | section 단위 메시지 분기 | VERIFIED | line 76 sectionId 분기, SectionPreviewRequest/Response 타입 |
| `client/test/unit/markdown-section-index.test.ts` | fenced code block 테스트 포함 18개 | VERIFIED | 167줄, line 128-166 fenced code block 테스트 5건 |
| `MarkdownScopeResolver.java` | section-update -> section/{id} EXCLUSIVE + payload 검증 | VERIFIED | line 42-44 null payload guard, line 46 blank sectionId, line 50-55 offset 음수/역전, line 57 section scope |
| `MarkdownCollaborationPlugin.java` | @Component, pluginId="markdown" | VERIFIED | @Component, MarkdownScopeResolver 내부 생성 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `use-markdown-document-session.ts` | `markdown-section-projector.ts` | `import buildSectionCommands` | WIRED | line 12 import, line 411 호출 |
| `markdown-document-mutation-applier.ts` | `markdown-yjs-document-adapter.ts` | `applySectionUpdate(doc, sectionId, sectionText, origin)` | WIRED | line 54 호출, sectionId 기반 시그니처 |
| `markdown-section-projector.ts` | `markdown-section-index.ts` | `import computeSectionBoundaries` | WIRED | line 1 import, line 39/40 호출 |
| `markdown-yjs-document-adapter.ts` | `markdown-section-index.ts` | `import computeSectionBoundaries` | WIRED | line 4 import, line 181 호출 (gap-fix) |
| `useMarkdownSectionPreview` | `markdown-preview-worker.ts` | `Worker.postMessage({ id, sectionId, sectionText })` | WIRED | line 152 postMessage |
| `useMarkdownSectionPreview` | `SectionPreviewCache` | 캐시 조회/갱신 | WIRED | line 41 cacheRef, line 105-117 사용 |
| `MarkdownDocumentPage.tsx` | `useMarkdownSectionPreview` | import + 호출 | WIRED | line 22 import, line 106 호출 |
| `MarkdownDocumentPage.tsx` | `RemotePendingBanner` | JSX 렌더링 + activeSectionId | WIRED | line 11 import, line 232-237 JSX |
| `RemotePendingBanner` | `onAccept` callback | D-07 자동 수락 | WIRED | line 60-62 useEffect 내 onAccept() |
| `MarkdownCollaborationPlugin` | `CollaborationPluginRegistry` | `@Component` Spring Bean | WIRED | @Component 어노테이션 |
| `MarkdownScopeResolver` | `rootScope()` | 잘못된 payload fallback | WIRED | line 43/47/55 guard -> rootScope() |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `useMarkdownSectionPreview` | `html` state | Worker + SectionPreviewCache.buildFullHtml() | Worker가 marked + DOMPurify로 실제 HTML 렌더링 | FLOWING |
| `markdown-section-projector.ts` | SectionCommand[] | computeSectionBoundaries + prevBody/nextBody 비교 | 실제 body diff 기반 커맨드 생성 | FLOWING |
| `MarkdownScopeResolver` | ScopeRef | commandKey + payload.sectionId | 실제 payload 기반 scope 해석 + 검증 guard | FLOWING |
| `markdown-yjs-document-adapter.ts` | applySectionUpdate | computeSectionBoundaries(currentBody) -> find(sectionId) | 실시간 Y.Text body 기반 경계 재계산 | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (서버/Worker/WebSocket 실행 필요, 정적 코드 분석으로 대체 완료)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOC-01 | 01-01, 01-02, 01-03, 01-05, 01-06, 01-07 | 마크다운 에디터에서 두 사용자가 다른 Section을 동시 편집할 때 Section 단위 증분 동기화가 동작한다 | SATISFIED | section 경계 계산 (fenced code block aware), buildSectionCommands, applySectionUpdate (sectionId 재계산), MarkdownScopeResolver (payload 검증), RemotePendingBanner D-07/D-08 |
| DOC-02 | 01-01, 01-04, 01-06 | 마크다운 에디터에서 변경된 Section만 프리뷰가 재렌더링된다 (증분 프리뷰) | SATISFIED | SectionPreviewCache (stale GC 포함), useMarkdownSectionPreview, MarkdownDocumentPage 사용 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (없음) | - | - | - | - |

전체 14개 신규/수정 파일에 TODO, FIXME, PLACEHOLDER, HACK, XXX 패턴 없음.

### Human Verification Required

### 1. 실시간 다중 사용자 Section 동시 편집 테스트

**Test:** 두 브라우저에서 같은 마크다운 문서를 열고, 각각 다른 heading 아래 section을 동시에 편집한다.
**Expected:** 양쪽 편집이 충돌 없이 각 section에 독립 적용되고, 상대방 section 변경 시 배너 없이 자동 수락된다 (D-07).
**Why human:** 실시간 WebSocket + Yjs 동기화는 서버 + 두 클라이언트 동시 실행 필요

### 2. 같은 Section 동시 편집 시 3버튼 배너 확인

**Test:** 두 브라우저에서 같은 section을 동시에 편집한다.
**Expected:** 상대방 변경 시 수락/거절/병합 배너가 표시된다 (D-08).
**Why human:** UI 렌더링 + 사용자 인터랙션 시나리오

### 3. Fenced Code Block 내 Heading 오탐 방지

**Test:** fenced code block 내 `# Not a heading` 을 포함하는 문서에서 section 분할을 확인한다.
**Expected:** code block 내 `#` 이 heading으로 처리되지 않고, 올바른 section만 분할된다.
**Why human:** 에디터 UI에서 시각적 section 경계 확인 필요

### 4. 증분 프리뷰 캐시 동작

**Test:** 긴 마크다운 문서(20+ section)에서 한 section만 수정한다.
**Expected:** 편집한 section만 프리뷰가 업데이트되고, 다른 section의 프리뷰는 깜빡임 없이 유지된다.
**Why human:** 프리뷰 재렌더링 성능과 시각적 깜빡임은 체감 확인 필요

## Gap Closure Summary

Cross-AI 리뷰에서 지적된 HIGH 2건 + MEDIUM 3건이 모두 수정 완료되었다:

### Plan 01-05 (HIGH -- offset 밀림 + RemotePendingBanner 미배선)
- **applySectionUpdate**: 시그니처를 `(doc, sectionId, sectionText, origin)`으로 변경. 절대 offset 대신 `computeSectionBoundaries(currentBody)`로 현재 body에서 동적 경계 재계산 (commit `96b864b`)
- **RemotePendingBanner**: `MarkdownDocumentPage.tsx`에 import + JSX 렌더링 완료, `activeSectionId` prop 전달 (commit `a704df9`)
- **activeSectionId 추적**: `use-markdown-document-session.ts`에서 마지막 section-update 커맨드 기준으로 추적
- **remoteMutation 감지**: `subscribeDocumentChanges` 이벤트에서 `origin.source === 'remote'` 시 remoteMutation 상태 설정

### Plan 01-06 (MEDIUM -- code fence 오탐 + 캐시 GC)
- **fenced code block skip**: `findFencedCodeRanges()` 헬퍼로 [start, end) 범위 사전 계산, heading 매칭 시 `insideFence` 필터링 (commit `753dcce`)
- **테스트 5건 추가**: backtick fence, tilde fence, unclosed fence, info string fence, 4+ backtick 중첩 fence (commit `2a62893`)
- **SectionPreviewCache GC**: `updateSectionOrder` 내 `activeIds` Set 기반 stale 키 삭제 (commit `4637fe3`)

### Plan 01-07 (MEDIUM -- payload 검증)
- **null payload guard**: `payload == null` 시 `rootScope()` fallback
- **blank sectionId guard**: `!(sectionId instanceof String sid) || sid.isBlank()` 시 `rootScope()` fallback
- **offset 검증**: `instanceof Number` + `longValue()` 패턴으로 음수/역전 검증 (commit `da730f6`)

### 회귀 없음

원래 7개 truth 전부 재검증 통과. 기존 아티팩트의 존재/실체/연결이 모두 유지됨. 모든 gap closure 커밋이 git log에서 확인됨.

---

_Verified: 2026-04-02T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
