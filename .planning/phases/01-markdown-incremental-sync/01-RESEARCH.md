# Phase 1: 마크다운 증분 동기화 - Research

**Researched:** 2026-04-02 (re-research)
**Domain:** Yjs Y.Text CRDT + diff-match-patch 증분 적용, Section Index Projector, 증분 프리뷰 렌더링
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-03:** 같은 section을 두 사용자가 동시 편집할 때 Y.Text CRDT 문자 단위 병합을 허용한다. Section Lock으로 차단하지 않는다.
- **D-04:** 다른 section을 편집하는 사용자 간에는 scope 분리로 독립 동작한다.
- **D-05:** 변경된 section만 Web Worker로 재파싱/렌더링하고, 나머지 section은 캐시된 HTML을 유지한다 (Section HTML 캐시 전략).
- **D-06:** 기존 Phase 9-A의 비동기 Worker 파이프라인을 확장하여 section 단위 처리를 추가한다.
- **D-07:** 다른 사용자가 다른 section을 수정한 경우 배너 없이 자동 수락한다.
- **D-08:** 같은 section 충돌 시 기존 remote-pending 3버튼 UI(수락/거절/병합)를 유지한다.

### Claude's Discretion

- 동기화 구현 방식 (diff-match-patch vs Y.Text 직접 조작) — 기술적 최적안 선택
- Section 구조 변경 시 fallback 전략 — 안전성 우선 판단
- Section Index Projector 구현 세부사항 (Y.Map 구조, 갱신 타이밍)
- 프리뷰 캐시 무효화 로직 세부사항

### Deferred Ideas (OUT OF SCOPE)

없음 — 논의가 Phase 범위 내로 유지됨
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | 마크다운 에디터에서 두 사용자가 다른 Section을 동시 편집할 때 Section 단위 증분 동기화가 동작한다 | diff-match-patch로 변경 offset 계산 → section 식별 → `markdown:section-update` 커맨드 발행 → `applyIncrementalTextUpdate()`로 Y.Text 범위 한정 업데이트. BE: `MarkdownCollaborationPlugin.java` 신규(ScopeResolver 포함) |
| DOC-02 | 마크다운 에디터에서 변경된 Section만 프리뷰가 재렌더링된다 (증분 프리뷰) | `useMarkdownPreview` → `useMarkdownSectionPreview`로 확장. section ID → HTML 캐시 Map. Worker 프로토콜에 `sectionId` 추가 |
</phase_requirements>

---

## Summary

이 Phase는 마크다운 에디터의 동기화 방식을 **전체 문서 교체(delete-all/insert-all)**에서 **Section 단위 증분 업데이트**로 전환하고, 프리뷰 렌더링도 **변경된 Section만 재렌더링**하는 방식으로 개선한다.

실제 코드 분석에서 확인된 현재 상태: `setEditorBuffer(nextBuffer)` → `documentMutationSession.emitCommand({ key: 'markdown:body-replace', payload: { buffer: nextBuffer } })` → `MarkdownDocumentMutationApplier.applyBufferReplace()` → `MarkdownYjsDocumentAdapter.replaceBuffer()` → Y.Text 전체 delete→insert 순으로 동작한다. `markdown:section-update` 케이스는 `apply()` switch에 이미 존재하지만 `applyBufferReplace(mutation)`으로 위임되며, **payload.buffer 필드로 전체 버퍼를 받는 구조**이다 — 증분 payload(`sectionId`, `sectionText`, `startOffset`, `endOffset`)로 교체가 이 Phase의 핵심 수정이다.

추가 발견 사항: (1) `RemotePendingBanner.tsx` 파일은 존재하지 않는다 — 마크다운 에디터의 remote-pending UI가 미구현 상태이며 이 Phase에서 신규 구현이 필요하다. (2) BE에는 `ScopeResolver` 인터페이스만 존재하고 `implements ScopeResolver`인 구체 구현체가 없다 — `MarkdownCollaborationPlugin.java`(신규)에서 `ScopeResolver`를 함께 구현해야 한다. (3) FE `MarkdownScopeResolver`는 `markdown-document-plugin.ts`에 이미 구현되어 있어 수정만 필요하다.

**Primary recommendation:** diff-match-patch로 변경 offset을 계산하고 `computeSectionBoundaries()`로 영향 section을 식별하여 `markdown:section-update` 커맨드를 발행한다. `MarkdownDocumentMutationApplier`에서 해당 케이스를 증분 Y.Text 적용으로 교체하고, 프리뷰는 `useMarkdownPreview` 훅을 section-aware 방식으로 확장한다.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `diff-match-patch` | 1.0.5 | 텍스트 diff 계산 (변경 offset 추출) | 설계 문서에서 명시 선택. Y.Text.delete/insert 연산과 자연스럽게 대응 |
| `@types/diff-match-patch` | 1.0.36 | TypeScript 타입 정의 | diff-match-patch 공식 타입 패키지 |
| `yjs` | 13.6.29 (현재 설치) | Y.Text CRDT + Y.Doc.transact | 이미 설치 및 사용 중 |
| `marked` | 14.0.0 (현재 설치) | Section HTML 렌더링 (Worker 내부) | 이미 Worker(`markdown-preview-worker.ts`)에서 사용 중 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:test` | 내장 | 단위 테스트 | 기존 `test/unit/` 패턴과 동일 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| diff-match-patch | fast-diff, jsdiff | diff-match-patch가 설계 문서에서 명시적으로 선택됨. DIFF_EQUAL/DELETE/INSERT 연산이 Y.Text cursor 기반 delete/insert와 1:1 대응 |
| Section HTML 캐시 Map | 전체 재렌더링 | DOC-02 요구사항을 충족하는 유일한 방법 |

**Installation (현재 미설치):**
```bash
cd client && npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd
```

**Version verification (npm registry 확인):**
- `diff-match-patch`: 1.0.5 (확인됨)
- `@types/diff-match-patch`: 1.0.36 (확인됨)

---

## Architecture Patterns

### 현재 코드베이스 상태 (CRITICAL — 코드 직접 분석)

**FE mutation 경로 (확인된 실제 코드):**
```
setEditorBuffer(nextBuffer)
  → emitCommand({ key: 'markdown:body-replace', payload: { buffer: nextBuffer } })
  → MarkdownDocumentMutationApplier.apply()
      case 'markdown:body-replace': applyBufferReplace(mutation)  ← buffer 필드
      case 'markdown:section-update': applyBufferReplace(mutation) ← 현재: 전체 교체와 동일!
  → MarkdownYjsDocumentAdapter.replaceBuffer(doc, buffer, key)
      → Y.Text 전체 delete(0, len) + insert(0, nextBody)
```

**중요: 현재 `markdown:section-update` case는 `payload.buffer` (전체 버퍼 문자열)를 기대한다.** 증분 동기화로 전환하면 payload 구조가 `{ sectionId, sectionText, startOffset, endOffset }`으로 바뀐다.

**FE ScopeResolver 상태 (확인됨):**
`markdown-document-plugin.ts`의 `MarkdownScopeResolver` 클래스에 `markdown:section-update` case가 이미 구현되어 있다. `sectionId`를 payload에서 추출하여 `{ kind: 'section', id: sectionId, mode: 'exclusive' }` scope를 반환한다.

**BE ScopeResolver 상태 (확인됨):**
`ScopeResolver.java` 인터페이스만 존재하고 `implements ScopeResolver`인 구체 구현체가 없다. `BaseCollaborationPlugin` 인터페이스의 `scopeResolver()` 메서드도 구현체가 없다. `MarkdownCollaborationPlugin.java` 신규 생성이 필요하다.

**RemotePendingBanner 상태 (확인됨):**
`RemotePendingBanner.tsx` 파일이 존재하지 않는다. `DraftState` 계약(`draft-state.ts`)과 `remote-pending` 상태 전이는 정의되어 있으나, 마크다운 에디터에는 해당 UI가 없다. `DslCodeEditorPanel.tsx`의 remote-pending 처리는 ERD DSL 전용이다.

**Worker 프리뷰 상태 (확인됨):**
`useMarkdownPreview(body: string): string` 훅이 `client/src/hooks/useMarkdownPreview.ts`에 구현되어 있다. 단일 `requestIdRef`로 최신 요청만 처리한다. `markdown-preview-worker.ts`는 `{ id, body }` 요청 → `{ id, html }` 응답 프로토콜이다.

**heading ID 현황 (확인됨):**
`extractHeadingItems(body)`가 `heading-{index}-{slug}` 패턴으로 ID를 생성한다. `slugify()` 함수는 `lib/markdown.ts`에 이미 존재하며 한글 지원(`가-힣`)을 포함한다.

**`MarkdownDocumentReadContextFactory.listRelated()` (확인됨):**
`relation === 'sections'` 시 `parseMarkdownBuffer().headings`를 사용하여 `{ kind: 'section', id: heading.id }` 배열을 반환한다. 현재 index 기반 ID를 사용하므로 Section Index 안정화 후 함께 갱신해야 한다.

### Recommended Project Structure (신규 파일)

```
client/src/
├── lib/
│   └── markdown-section-index.ts          # Section offset 계산 (순수 함수)
├── hooks/
│   └── useMarkdownSectionPreview.ts        # Section HTML 캐시 기반 증분 프리뷰 훅
├── collaboration/
│   └── plugins/markdown/
│       └── markdown-section-projector.ts  # buildCommands 로직 (section-update vs body-replace 결정)
└── test/unit/
    ├── markdown-section-index.test.ts     # Section offset 단위 테스트
    ├── markdown-section-update.test.ts    # 증분 Y.Text 적용 단위 테스트
    └── markdown-section-preview.test.ts  # Section HTML 캐시 단위 테스트

client/src/components/markdown/
└── MarkdownRemotePendingBanner.tsx        # remote-pending 3버튼 UI (신규)

src/main/java/com/smarterd/domain/diagram/collaboration/
└── MarkdownCollaborationPlugin.java       # BE markdown plugin (ScopeResolver 포함)
```

### 수정 대상 파일 (기존)

```
client/src/
├── pages/document/
│   ├── use-markdown-document-session.ts   # setEditorBuffer: section-update 커맨드 발행 로직 추가
│   └── MarkdownDocumentPage.tsx           # useMarkdownSectionPreview 연결
├── collaboration/plugins/markdown/
│   ├── markdown-document-mutation-applier.ts  # section-update case: 증분 적용으로 교체
│   └── markdown-document-plugin.ts            # MarkdownScopeResolver: 이미 구현, 수정 불필요
├── collaboration/yjs/
│   └── markdown-yjs-document-adapter.ts       # applySectionUpdate() 메서드 추가
├── collaboration/plugins/markdown/query/
│   └── markdown-document-read-context-factory.ts  # listRelated sections: slug ID로 갱신
├── lib/
│   └── markdown.ts                        # extractHeadingItems: slug ID로 변경
└── hooks/
    └── useMarkdownPreview.ts              # (기존 유지, useMarkdownSectionPreview는 별도 파일)
```

### Pattern 1: Section Boundary 계산

**What:** markdown body에서 heading 위치를 기준으로 section 경계(startOffset, endOffset) 배열 계산
**When to use:** `setEditorBuffer()` 호출 시 어떤 section이 변경됐는지 판별

```typescript
// Source: 설계 문서 02-편집-모델.md, 기존 extractHeadingItems 패턴 (lib/markdown.ts)
export interface SectionBoundary {
  /** heading offset (body 내 character offset) */
  startOffset: number;
  /** 다음 section 시작 offset (마지막 section은 body.length) */
  endOffset: number;
  /** slug 기반 안정적 section ID (충돌 시 -1/-2 접미사) */
  id: string;
  /** heading level (1~6) */
  level: number;
  /** heading 텍스트 */
  text: string;
}

/**
 * markdown body에서 section 경계 배열을 계산한다.
 * heading 이전 영역은 id='root'로 처리한다.
 *
 * @param body markdown 본문 (frontmatter 제외, \r\n 정규화 후)
 * @returns section 경계 배열 (순서 보장)
 */
export function computeSectionBoundaries(body: string): SectionBoundary[] { ... }

/**
 * 변경된 offset 범위가 속하는 section ID를 반환한다.
 *
 * @param boundaries computeSectionBoundaries 결과
 * @param changeStart 변경 시작 offset
 * @param changeEnd 변경 종료 offset
 * @returns 단일 section 내 변경이면 sectionId, 경계를 넘으면 null
 */
export function findAffectedSection(
  boundaries: SectionBoundary[],
  changeStart: number,
  changeEnd: number,
): string | null { ... }
```

**Section ID 안정성 전략:** `slugify(headingText)` 기반 ID 사용. 동일 slug가 여러 번 등장하면 `-1`, `-2` 접미사 추가. `slugify()`는 이미 `lib/markdown.ts`에 구현되어 있으므로 재사용한다.

### Pattern 2: diff-match-patch → Y.Text 증분 적용

**What:** 이전/현재 section 텍스트 diff를 계산하여 Y.Text 범위 한정 업데이트
**When to use:** `MarkdownDocumentMutationApplier.applySectionUpdate()` 내부

```typescript
// Source: 설계 문서 03-플러그인-통합.md "markdown:body-replace의 Y.Text 최적화"
import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from 'diff-match-patch';
import * as Y from 'yjs';

/**
 * 이전/현재 텍스트 diff를 Y.Text 연산으로 변환하여 적용한다.
 * 반드시 Y.Doc.transact() 내부에서 호출해야 한다.
 *
 * @param yText 대상 Y.Text
 * @param prevText 이전 텍스트 (Y.Text 현재 값의 해당 section 범위)
 * @param nextText 변경된 텍스트
 */
export function applyIncrementalTextUpdate(
  yText: Y.Text,
  prevText: string,
  nextText: string,
  baseOffset: number,
): void {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(prevText, nextText);
  dmp.diff_cleanupSemantic(diffs);

  let cursor = baseOffset;
  for (const [op, text] of diffs) {
    if (op === DIFF_EQUAL) {
      cursor += text.length;
    } else if (op === DIFF_DELETE) {
      yText.delete(cursor, text.length);
      // delete 후 cursor 이동 없음 (삭제된 만큼 offset이 당겨짐)
    } else if (op === DIFF_INSERT) {
      yText.insert(cursor, text);
      cursor += text.length;
    }
  }
}
```

**Y.Doc.transact() 보장:** `MarkdownYjsDocumentAdapter`에 `applySectionUpdate(doc, sectionId, sectionText, startOffset, endOffset, origin)` 메서드를 추가하고, 내부에서 `doc.transact(() => { applyIncrementalTextUpdate(...) }, origin)`으로 감싼다.

### Pattern 3: section-update 커맨드 발행 (FE)

**What:** 편집 변경이 단일 section 내에 있으면 `markdown:section-update`, 경계를 넘으면 `markdown:body-replace` 발행
**When to use:** `use-markdown-document-session.ts`의 `setEditorBuffer()` 개선

```typescript
// Source: 설계 문서 02-편집-모델.md buildCommands 2단계 전략
// 신규 payload 구조 (이전 payload.buffer와 다름)
{
  pluginId: 'markdown',
  key: 'markdown:section-update',
  payload: {
    sectionId: 'api-설계',        // section scope ID
    sectionText: '## API 설계\n\n수정된 내용',
    startOffset: 120,              // body 내 section 시작 offset
    endOffset: 280,                // body 내 section 종료 offset
  },
}
```

**buildCommands 로직 (markdown-section-projector.ts 신규):**
1. `prevBody`와 `nextBody`를 diff-match-patch로 비교하여 변경 offset 범위 추출
2. `computeSectionBoundaries(nextBody)` 호출
3. `findAffectedSection(boundaries, changeStart, changeEnd)` 호출
4. 단일 section → `markdown:section-update` 커맨드 반환
5. section 경계 초과, heading 추가/삭제 감지 → `markdown:body-replace` fallback

### Pattern 4: MarkdownDocumentMutationApplier 수정

**What:** `markdown:section-update` case를 증분 적용 메서드로 교체
**When to use:** `markdown-document-mutation-applier.ts` 수정

```typescript
// Source: client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts
// 현재 상태:
case 'markdown:section-update':
  return this.toApplyResult(this.applyBufferReplace(mutation)); // ← 전체 교체, payload.buffer 사용

// 수정 후:
case 'markdown:section-update':
  return this.toApplyResult(this.applySectionUpdate(mutation)); // ← 증분 적용, 신규 payload 구조

private applySectionUpdate(mutation: DocumentMutation): boolean {
  const sectionId = typeof mutation.payload?.sectionId === 'string' ? mutation.payload.sectionId : null;
  const sectionText = typeof mutation.payload?.sectionText === 'string' ? mutation.payload.sectionText : null;
  const startOffset = typeof mutation.payload?.startOffset === 'number' ? mutation.payload.startOffset : null;
  const endOffset = typeof mutation.payload?.endOffset === 'number' ? mutation.payload.endOffset : null;
  if (sectionId == null || sectionText == null || startOffset == null || endOffset == null) {
    return false;
  }
  this.documentAdapter.applySectionUpdate(
    this.engine.getDocument(),
    sectionId, sectionText, startOffset, endOffset,
    mutation.key,
  );
  return true;
}
```

### Pattern 5: Section HTML 캐시 (증분 프리뷰)

**What:** section ID → HTML 캐시 Map, 변경된 section만 Worker 재요청
**When to use:** `useMarkdownSectionPreview` 훅 (신규) + `MarkdownDocumentPage` 연결

```typescript
// Source: 설계 문서 08-후속-phase-로드맵.md Phase 9-B + 기존 useMarkdownPreview.ts 패턴
// 기존 Worker 프로토콜 { id, body } → 확장: { id, sectionId, body }
// Worker 응답 프로토콜 { id, html } → 확장: { id, sectionId, html }

interface SectionPreviewRequest {
  id: number;
  sectionId: string;
  body: string;
}

interface SectionPreviewResponse {
  id: number;
  sectionId: string;
  html: string;
}

/**
 * section 단위 증분 프리뷰를 관리한다.
 * 변경된 section만 Worker에 재렌더링 요청하고 나머지는 캐시를 유지한다.
 *
 * @param body markdown 본문
 * @param changedSectionIds 이번 변경에서 영향받은 section ID 집합
 * @param boundaries 현재 section 경계 배열
 * @returns 전체 프리뷰 HTML (section 순서대로 조합)
 */
export function useMarkdownSectionPreview(
  body: string,
  changedSectionIds: ReadonlySet<string>,
  boundaries: SectionBoundary[],
): string { ... }
```

**section별 requestId Map:** 기존 `requestIdRef.current` (단일 숫자)를 `requestIdMap: Map<string, number>`으로 교체하여, 응답의 `sectionId + id`가 현재 최신 요청과 일치하는 경우에만 캐시를 갱신한다.

### Pattern 6: MarkdownCollaborationPlugin (BE 신규)

**What:** BE에서 markdown 플러그인 ScopeResolver 구현
**When to use:** `MarkdownCollaborationPlugin.java` 신규 생성

```java
// Source: 설계 문서 03-플러그인-통합.md ScopeResolver 섹션
// 참조: DiagramCollaborationChannelPlugin.java 패턴
package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.plugin.BaseCollaborationPlugin;
import com.smarterd.collaboration.plugin.DomainValidationHook;
import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.plugin.ScopeRef;
import com.smarterd.collaboration.plugin.ScopeResolver;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * markdown 문서 collaboration plugin.
 * section 단위 scope lock을 해석한다.
 */
@Component
public class MarkdownCollaborationPlugin implements BaseCollaborationPlugin {

    public static final String PLUGIN_ID = "markdown";

    @Override
    @NonNull
    public String pluginId() {
        return PLUGIN_ID;
    }

    @Override
    public int schemaVersion() {
        return 1;
    }

    @Override
    @NonNull
    public Set<String> supportedEngineIds() {
        return Set.of("yjs");
    }

    @Override
    @NonNull
    public ScopeResolver scopeResolver() {
        return (commandKey, payload) -> switch (commandKey) {
            case "markdown:section-update" -> {
                final var sectionId = payload != null ? payload.get("sectionId") : null;
                if (!(sectionId instanceof String sid) || sid.isBlank()) {
                    yield List.of(rootScope());
                }
                yield List.of(new ScopeRef("section", sid, ScopeLockMode.EXCLUSIVE));
            }
            default -> List.of(rootScope());
        };
    }

    @Override
    @NonNull
    public DomainValidationHook validationHook() {
        return (commandKey, payload) -> {};
    }

    private static ScopeRef rootScope() {
        return new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE);
    }
}
```

### Pattern 7: MarkdownRemotePendingBanner (신규)

**What:** 마크다운 에디터의 remote-pending 상태 UX (D-07/D-08 구현)
**When to use:** `MarkdownDocumentPage.tsx`에서 remote-pending 상태 시 표시

remote-pending 상태는 현재 마크다운 에디터에 미구현이다. `DraftState.reconcileState === 'remote-pending'`가 되는 시점에 표시할 배너 컴포넌트를 신규 구현해야 한다.

D-07: 원격 변경이 **다른 section**이면 자동 수락 (배너 없음)
D-08: 원격 변경이 **같은 section**이면 3버튼 UI (수락/유지+리베이스/나중에)

```typescript
// Source: 설계 문서 02-편집-모델.md remote-pending 3버튼 UI
// MarkdownRemotePendingBanner.tsx props
interface MarkdownRemotePendingBannerProps {
  /** 충돌 중인 section ID (null이면 문서 전체 충돌) */
  conflictSectionId: string | null;
  onAcceptRemote: () => void;
  onKeepLocalAndRebase: () => void;
  onCompareLater: () => void;
}
```

### Anti-Patterns to Avoid

- **전체 재계산 후 전체 교체:** heading 추가/삭제 등 구조 변경을 제외한 모든 section 편집에 `markdown:body-replace` fallback을 사용하면 이 Phase의 목적을 달성하지 못한다. 단일 section 내 변경은 반드시 `markdown:section-update`를 사용한다.
- **Section ID에 index 사용:** `heading-{index}-{slug}` 패턴은 heading 추가 시 모든 이후 section ID가 shift된다. slug 전용 ID로 교체한다.
- **applyIncrementalTextUpdate를 transact 외부에서 호출:** Y.Text.delete/insert 중간 상태가 원격에 전파된다. 반드시 `doc.transact()` 내부에서 호출한다.
- **Worker에 전체 body 전달:** 기존 `{ id, body }` 프로토콜을 그대로 사용하면 section 단위 캐시 갱신이 불가능하다. `{ id, sectionId, body }` 형태로 section body만 전달한다.
- **코어 수정:** `DocumentStore`, `ChangeBus`, `CollaborationRuntime` 등 코어 모듈은 수정하지 않는다. 플러그인 계약(ScopeResolver, MutationApplier) 레이어에서만 변경한다.
- **RemotePendingBanner 없이 remote-pending 상태 방치:** 마크다운 에디터에 remote-pending UI가 없으면 사용자는 충돌이 발생했는지 알 수 없다.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 텍스트 diff 계산 | 직접 LCS/diff 구현 | `diff-match-patch` | Google 제작, edge case 처리 완성도, delete/insert cursor 방식이 Y.Text와 1:1 대응 |
| Y.Text 증분 적용 | delete(0,all) + insert(0,all) | diff-match-patch diff → 범위 delete/insert | CRDT 이점 보존 (문자 단위 병합 유지) |
| Section HTML 렌더링 | 새 렌더러 구현 | 기존 `marked` + `DOMPurify` (`markdown-preview-worker.ts`) | Worker에 완성된 파이프라인 존재, 프로토콜 확장만 필요 |
| section ID 생성 | UUID | slug 기반 ID (`slugify()` 재사용 + 충돌 접미사) | 사람이 읽을 수 있고, 이미 `lib/markdown.ts`에 `slugify()` 구현됨 |

**Key insight:** Y.Text의 CRDT는 문자 단위 병합을 자동으로 처리한다. 이 Phase의 핵심은 "어떤 section이 변경됐는가"를 정확히 식별하고, Y.Text의 올바른 offset 범위에만 적용하는 것이다. diff-match-patch가 이 계산을 담당한다.

---

## Common Pitfalls

### Pitfall 1: Section ID 불안정성

**What goes wrong:** heading 추가/삭제 시 index 기반 ID(`heading-{index}-{slug}`)가 모두 shift되어 잘못된 section에 커맨드가 적용된다.
**Why it happens:** 현재 `extractHeadingItems()`의 `heading-{index}-{slug}` 패턴은 index를 포함한다. `MarkdownDocumentReadContextFactory.listRelated()`도 같은 ID를 사용한다.
**How to avoid:** `computeSectionBoundaries()`에서 `slugify(headingText)` 기반 ID를 사용하고, 동일 slug 충돌 시에만 `-1`, `-2` 접미사를 추가한다. `lib/markdown.ts`의 `extractHeadingItems()`도 일관성을 위해 동일 방식으로 변경한다.
**Warning signs:** 다른 section 편집 내용이 엉뚱한 section에 반영되는 경우.

### Pitfall 2: section-update payload 필드명 혼동

**What goes wrong:** 기존 `applyBufferReplace()`는 `mutation.payload?.buffer` (전체 버퍼 문자열)를 사용한다. 신규 `applySectionUpdate()`는 `{ sectionId, sectionText, startOffset, endOffset }` 구조를 사용한다. 두 경로를 혼동하면 null 체크 실패로 `applied: false`가 반환된다.
**Why it happens:** 기존 `markdown:section-update` case가 `applyBufferReplace(mutation)`으로 위임되어 있어 payload 구조가 `body-replace`와 동일했다.
**How to avoid:** `applySectionUpdate()`는 `payload.buffer` 필드를 절대 참조하지 않는다. `payload.sectionId`, `payload.sectionText`, `payload.startOffset`, `payload.endOffset`만 사용한다.
**Warning signs:** `apply()` 결과가 항상 `{ applied: false }`로 반환되는 경우.

### Pitfall 3: Y.Text transact 외부에서 부분 적용

**What goes wrong:** `applyIncrementalTextUpdate()`를 `transact()` 없이 순차 호출하면 중간 상태(delete 후 insert 전)가 원격에 전파된다.
**Why it happens:** 기존 `replaceBuffer()`는 `doc.transact(() => { ... }, origin)`으로 감싸져 있지만, 신규 증분 적용 경로에서 transact를 누락하기 쉽다.
**How to avoid:** `MarkdownYjsDocumentAdapter.applySectionUpdate()`에서 `doc.transact()` 보장. `applyIncrementalTextUpdate()`는 transact 내부에서만 호출되도록 설계한다.
**Warning signs:** 원격 클라이언트에서 부분 적용 상태가 순간 보이는 경우.

### Pitfall 4: Heading 추가/삭제 시 section 경계 오판

**What goes wrong:** 새 heading `## 새 섹션`을 추가하면 이후 모든 section의 startOffset이 변경된다. `computeSectionBoundaries()`가 이전 상태를 참조하면 wrong offset에 적용된다.
**Why it happens:** `buildCommands(prevBody, nextBody)`에서 `prevBoundaries`와 `nextBoundaries`를 혼용하는 경우.
**How to avoid:** `markdown-section-projector.ts`의 `buildCommands()`에서 heading 개수 변화를 먼저 감지한다. heading 추가/삭제가 있으면 즉시 `markdown:body-replace` fallback을 반환한다. `findAffectedSection()`은 항상 `nextBoundaries` 기준으로 호출한다.
**Warning signs:** heading 추가 후 문서 구조가 어긋나는 경우.

### Pitfall 5: Worker 응답 순서 불일치 (section 캐시)

**What goes wrong:** 여러 section이 빠르게 연속 변경되면 Worker 응답 순서가 요청 순서와 다를 수 있다. 이전 응답이 최신 응답을 덮어쓴다.
**Why it happens:** 기존 `useMarkdownPreview`의 `requestIdRef.current`는 단일 숫자로 전체 문서의 최신 요청만 추적한다. section별로 독립 추적하지 않는다.
**How to avoid:** `useMarkdownSectionPreview`에서 `requestIdMap: Map<string, number>`를 사용하여 section별 최신 requestId를 추적한다. `sectionId + id`가 현재 맵의 값과 일치하는 응답만 캐시에 반영한다.
**Warning signs:** 프리뷰가 깜빡이거나 이전 section 내용으로 되돌아가는 경우.

### Pitfall 6: remote-pending UI 미구현으로 UX 손상

**What goes wrong:** 마크다운 에디터에 `MarkdownRemotePendingBanner`가 없으면 `DraftState.reconcileState === 'remote-pending'` 상태에서 사용자는 다른 사람이 같은 section을 수정했다는 것을 알 수 없다.
**Why it happens:** `RemotePendingBanner.tsx`가 존재하지 않고, ERD의 remote-pending 처리는 `DslCodeEditorPanel.tsx` 내부에 밀결합되어 있어 마크다운에서 재사용할 수 없다.
**How to avoid:** `MarkdownRemotePendingBanner.tsx`를 신규 구현하고 `MarkdownDocumentPage.tsx`에서 remote-pending 상태 감지 시 표시한다. D-07(다른 section → 자동 수락)도 이 컴포넌트 마운트 전 단계에서 처리한다.
**Warning signs:** 두 사용자가 같은 section을 동시 편집할 때 한 명의 변경이 조용히 사라지는 경우.

---

## Code Examples

### 현재 전체 교체 경로 (교체 대상 코드)

```typescript
// Source: client/src/pages/document/use-markdown-document-session.ts (line 372-392)
// 현재: 모든 편집에서 markdown:body-replace + payload.buffer 발행
const setEditorBuffer = useCallback(
  (nextBuffer: string) => {
    if (!documentMutationSession?.enabled || !collaborationReady) {
      return;
    }
    documentMutationSession.emitCommand(
      {
        key: 'markdown:body-replace',
        payload: { buffer: nextBuffer },
      },
      { origin: { source: 'local' } },
    );
  },
  [collaborationReady, documentMutationSession],
);
```

### 현재 replaceBuffer (Y.Text 전체 교체 — 수정 대상 부분)

```typescript
// Source: client/src/collaboration/yjs/markdown-yjs-document-adapter.ts (line 73-83)
const bodyText = this.getBodyText(doc);
const currentBody = bodyText.toString();
if (currentBody !== normalizedBody) {
  if (currentBody.length > 0) {
    bodyText.delete(0, currentBody.length);  // 전체 삭제
  }
  if (normalizedBody.length > 0) {
    bodyText.insert(0, normalizedBody);      // 전체 삽입
  }
}
// → 증분 메서드 applySectionUpdate(doc, sectionId, sectionText, startOffset, endOffset, origin) 추가
```

### 현재 mutation applier section-update case (수정 대상)

```typescript
// Source: client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts (line 22-23)
case 'markdown:section-update':
  return this.toApplyResult(this.applyBufferReplace(mutation));  // ← payload.buffer 기대, 전체 교체
// 수정 후: applySectionUpdate(mutation) 호출, payload.sectionId/sectionText/startOffset/endOffset 기대
```

### 기존 Worker 프로토콜 (확장 대상)

```typescript
// Source: client/src/lib/markdown-preview-worker.ts (line 37-49)
// 현재: { id, body } 요청 → { id, html } 응답 (전체 문서 렌더링)
self.addEventListener('message', (event: MessageEvent<PreviewRequest>) => {
  const { id, body } = event.data;
  const rawHtml = marked.parse(body, { async: false }) as string;
  const html = DOMPurify.sanitize(rawHtml, { ... });
  self.postMessage({ id, html });
});
// 확장: { id, sectionId, body } 요청 → { id, sectionId, html } 응답으로 변경
```

### BE MarkdownCollaborationPlugin 등록 패턴

```java
// Source: 설계 문서 03-플러그인-통합.md, DiagramCollaborationChannelPlugin.java 패턴
// @Component 선언으로 Spring이 CollaborationPluginRegistry에 자동 등록한다.
// (CollaborationPluginRegistry 구현이 Spring Bean List를 주입받는 방식이면 추가 설정 불필요)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 전체 Y.Text delete→insert | diff-match-patch 범위 update | 이 Phase | CRDT 병합 품질 향상, 네트워크 전송량 감소 |
| 전체 HTML 재렌더링 | Section HTML 캐시 Map | 이 Phase | 변경된 section만 Worker 재요청 |
| `document/root` 단일 scope | `section/{id}` scope 활성화 | 이 Phase | 다른 section 편집 사용자 간 scope 분리 |
| heading index 기반 ID | slug 기반 안정적 ID | 이 Phase | heading 추가/삭제 시 기존 section ID 보존 |
| remote-pending UI 없음 (마크다운) | MarkdownRemotePendingBanner 신규 구현 | 이 Phase | D-07/D-08 충족 |
| Worker `{ id, body }` 프로토콜 | `{ id, sectionId, body }` 확장 | 이 Phase | section 단위 캐시 가능 |

**Deprecated/outdated after this Phase:**
- `applyBufferReplace()` 내 `markdown:section-update` 위임 → `applySectionUpdate()` 독립 구현으로 교체
- `heading-{index}-{slug}` ID 생성 패턴 → slug 전용 ID로 교체 (extractHeadingItems, computeSectionBoundaries 일관)

---

## Open Questions

1. **`CollaborationPluginRegistry` 자동 수집 방식 확인 필요**
   - What we know: `CollaborationPluginRegistry`는 인터페이스로 정의됨. 구현체를 찾지 못했음.
   - What's unclear: Spring `@Component` 자동 등록 방식인지, 명시적 `@Bean` 등록 방식인지.
   - Recommendation: Wave 0에서 `CollaborationPluginRegistry` 구현체를 확인하고 `MarkdownCollaborationPlugin` 등록 방식을 결정한다.

2. **DraftState와 remote-pending 상태 전이 연결**
   - What we know: `DraftState.reconcileState === 'remote-pending'`는 코어에 정의됨. 마크다운 에디터는 현재 이 상태를 활용하지 않는다.
   - What's unclear: `subscribeDocumentChanges` 콜백에서 원격 변경을 감지하여 DraftState를 `remote-pending`으로 전이하는 로직이 마크다운 채널에 없다. `use-markdown-document-runtime.ts` + `collaboration-session-machine.ts` 조합 확인 필요.
   - Recommendation: Wave 0 또는 Wave 1에서 현재 마크다운 원격 변경 감지 경로를 추적하고, remote-pending 전이를 어디서 구현할지 결정한다.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 단위 테스트 (`node:test`) | ✓ | 20.15.1 | — |
| npm | 패키지 설치 | ✓ | 10.7.0 | — |
| diff-match-patch | 증분 diff 계산 | ✗ (미설치) | — | 설치 필요 |
| yjs | Y.Text CRDT | ✓ | 13.6.29 | — |
| marked | Section HTML 렌더링 (Worker) | ✓ | 14.0.0 | — |
| dompurify | HTML sanitize (Worker) | ✓ | 3.2.7 | — |

**Missing dependencies with no fallback:**
- `diff-match-patch`, `@types/diff-match-patch`: Wave 0에서 설치 필요. 증분 Y.Text 적용의 핵심 의존성.
  ```bash
  cd client && npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd
  ```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` |
| Config file | `client/tsconfig.test.json` + `client/scripts/rewrite-test-aliases.mjs` |
| Quick run command | `cd client && npm run test:unit` |
| Full suite command | `cd client && npm run test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | Section 경계 계산 정확성 (root, heading 전후, 마지막 section) | unit | `npm run test:unit` (markdown-section-index.test.ts) | ❌ Wave 0 |
| DOC-01 | slug 기반 section ID 안정성 (heading 추가/삭제 시 기존 ID 보존) | unit | `npm run test:unit` (markdown-section-index.test.ts) | ❌ Wave 0 |
| DOC-01 | 단일 section 변경 → section-update 커맨드 발행 | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-01 | heading 추가/삭제 시 body-replace fallback | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-01 | diff-match-patch → Y.Text 증분 적용 정확성 (transact 포함) | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-02 | 변경 section만 캐시 무효화, 나머지 캐시 보존 | unit | `npm run test:unit` (markdown-section-preview.test.ts) | ❌ Wave 0 |
| DOC-02 | section 경계 변경 시 전체 캐시 무효화 | unit | `npm run test:unit` (markdown-section-preview.test.ts) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd client && npm run test:unit`
- **Per wave merge:** `cd client && npm run test:unit`
- **Phase gate:** 전체 단위 테스트 통과 후 `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/test/unit/markdown-section-index.test.ts` — DOC-01: Section 경계 계산, slug ID 안정성
- [ ] `client/test/unit/markdown-section-update.test.ts` — DOC-01: buildCommands 전략, 증분 Y.Text 적용
- [ ] `client/test/unit/markdown-section-preview.test.ts` — DOC-02: Section HTML 캐시 무효화 로직
- [ ] `diff-match-patch` 패키지 설치: `npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd`

---

## Sources

### Primary (HIGH confidence)

- `plan/2026-03-26-마크다운-에디터-플러그인-설계/08-후속-phase-로드맵.md` — Phase 7 + Phase 9-B 구현 범위 (설계 원본), 직접 읽음
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/02-편집-모델.md` — buildCommands 전략, section-update 커맨드 정의, 직접 읽음
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/03-플러그인-통합.md` — ScopeResolver, MutationPolicy, 직접 읽음
- `client/src/collaboration/yjs/markdown-yjs-document-adapter.ts` — 현재 Y.Text 전체 교체 구현 (replaceBuffer), 직접 읽음
- `client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts` — section-update case가 applyBufferReplace로 위임됨 확인, 직접 읽음
- `client/src/collaboration/plugins/markdown/markdown-document-plugin.ts` — FE MarkdownScopeResolver 이미 구현됨 확인, 직접 읽음
- `client/src/hooks/useMarkdownPreview.ts` — 현재 Worker 파이프라인 (단일 requestIdRef), 직접 읽음
- `client/src/lib/markdown-preview-worker.ts` — Worker 현재 프로토콜 `{ id, body }`, 직접 읽음
- `client/src/pages/document/use-markdown-document-session.ts` — body-replace 발행 경로 + payload.buffer 구조, 직접 읽음
- `client/src/pages/document/MarkdownDocumentPage.tsx` — remote-pending UI 부재 확인, 직접 읽음
- `client/src/lib/markdown.ts` — extractHeadingItems index 기반 ID, slugify() 존재 확인, 직접 읽음
- `src/main/java/com/smarterd/collaboration/plugin/ScopeResolver.java` — BE 인터페이스, 구현체 없음 확인, 직접 읽음

### Secondary (MEDIUM confidence)

- npm registry: `diff-match-patch@1.0.5`, `@types/diff-match-patch@1.0.36` — `npm view` 명령으로 직접 확인

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — diff-match-patch는 설계 문서 명시, npm registry 확인, 기존 패키지 모두 설치 확인
- Architecture: HIGH — 실제 코드 파일 전체 분석 (이전 research보다 개선: payload 구조 불일치, RemotePendingBanner 미존재, BE ScopeResolver 미구현 확인)
- Pitfalls: HIGH — 실제 코드에서 payload 필드명 혼동, slug/index ID 불일치 등 구체적 위험 식별

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (diff-match-patch API 안정, 설계 문서 고정)
