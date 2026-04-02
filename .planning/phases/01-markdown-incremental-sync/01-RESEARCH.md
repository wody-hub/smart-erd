# Phase 1: 마크다운 증분 동기화 - Research

**Researched:** 2026-04-02
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
| DOC-01 | 마크다운 에디터에서 두 사용자가 다른 Section을 동시 편집할 때 Section 단위 증분 동기화가 동작한다 | diff-match-patch로 변경 Section 식별, `markdown:section-update` 커맨드로 scope 분리, MarkdownScopeResolver(BE 신규)가 `section/{id}` scope 처리 |
| DOC-02 | 마크다운 에디터에서 변경된 Section만 프리뷰가 재렌더링된다 (증분 프리뷰) | Section HTML 캐시 Map + Worker per-section 렌더링, sectionIndex로 변경 section 식별 |
</phase_requirements>

---

## Summary

이 Phase는 마크다운 에디터의 동기화 방식을 **전체 문서 교체(delete-all/insert-all)**에서 **Section 단위 증분 업데이트**로 전환하고, 프리뷰 렌더링도 **변경된 Section만 재렌더링**하는 방식으로 개선한다.

현재 구현에서 `setEditorBuffer(nextBuffer)` 호출 시 `markdown:body-replace` 커맨드 하나만 발행하며, `MarkdownYjsDocumentAdapter.replaceBuffer()`가 항상 전체 Y.Text를 delete→insert로 교체한다. 이는 동시 편집 시 CRDT 병합 품질을 저하시키고 불필요한 네트워크 전송을 유발한다.

증분 동기화의 핵심 흐름은 다음과 같다. (1) 에디터 변경 시 diff-match-patch로 변경 범위가 속한 section을 식별한다. (2) 단일 section 내 변경이면 `markdown:section-update` 커맨드를 발행하고, 해당 section의 offset 범위만 Y.Text에 적용한다. (3) heading 추가/삭제 등 section 경계를 넘는 변경은 `markdown:body-replace` fallback을 유지한다. (4) 프리뷰는 Section HTML 캐시 Map을 유지하며, 변경된 section ID만 Worker에 재파싱 요청한다.

**Primary recommendation:** diff-match-patch를 사용하여 변경 offset을 계산하고, `sectionIndex`(heading offset 배열)로 해당 section을 식별하여 `markdown:section-update` 커맨드로 범위 한정 Y.Text 업데이트를 적용한다. Section 구조 변경 시에는 전체 재동기화 fallback을 사용한다.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `diff-match-patch` | 1.0.5 | 텍스트 diff 계산 (변경 offset 추출) | Google 제작, 안정적 텍스트 diff. 설계 문서에서 명시적으로 지정 |
| `@types/diff-match-patch` | 1.0.36 | TypeScript 타입 정의 | diff-match-patch의 공식 타입 패키지 |
| `yjs` | 13.6.29 (현재 설치) | Y.Text CRDT + Y.Doc.transact | 이미 설치 및 사용 중 |
| `marked` | 14.0.0 (현재 설치) | Section HTML 렌더링 (Worker 내부) | 이미 설치 및 사용 중. Worker에서 재사용 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:test` | 내장 | 단위 테스트 | 기존 `test/unit/` 패턴과 동일 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| diff-match-patch | fast-diff, jsdiff | diff-match-patch가 Y.Text.applyDelta() 와 연산 단위(retain/delete/insert)가 자연스럽게 대응됨. 설계 문서에서 명시적 선택 |
| Section HTML 캐시 Map | 전체 재렌더링 | 캐시가 메모리 사용하지만 DOC-02 요구사항을 충족하는 유일한 방법 |

**Installation (현재 미설치):**
```bash
npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd
```

**Version verification:**
- `diff-match-patch`: npm registry 최신 1.0.5 (2023년, 안정 버전)
- `@types/diff-match-patch`: 1.0.36

---

## Architecture Patterns

### 현재 코드베이스 이해 (CRITICAL)

현재 `setEditorBuffer(nextBuffer)` → `documentMutationSession.emitCommand({ key: 'markdown:body-replace', payload: { buffer: nextBuffer } })` → `MarkdownDocumentMutationApplier.applyBufferReplace()` → `MarkdownYjsDocumentAdapter.replaceBuffer()` 순으로 전체 교체가 발생한다.

`replaceBuffer()`는 Y.Text의 currentBody와 normalizedBody가 다를 경우 항상 `bodyText.delete(0, currentBody.length)` + `bodyText.insert(0, normalizedBody)`를 수행한다. 이것이 교체 대상이다.

현재 `extractHeadingItems(body)` 함수는 `parseMarkdownBuffer()`에서 이미 heading offset-independent한 ID(`heading-{index}-{slug}`)를 계산하고 있다. 단, 이 ID는 index 기반이라 heading 추가/삭제 시 모든 이후 section의 ID가 변경된다. Section ID 안정성 전략이 필요하다.

`MarkdownDocumentReadContextFactory`의 `listRelated(doc, 'sections')`도 이미 `parseMarkdownBuffer()`의 headings를 사용하고 있어, section 인식 인프라가 부분적으로 존재한다.

`MarkdownDocumentMutationApplier`에서 `markdown:section-update`는 이미 `case`로 선언되어 있으나, 현재는 `applyBufferReplace(mutation)`으로 위임되어 전체 교체와 동일하게 동작한다. 이 케이스를 증분 적용으로 교체하는 것이 핵심 수정이다.

### Recommended Project Structure (신규 파일)

```
client/src/
├── lib/
│   └── markdown-section-index.ts    # Section offset 계산 (순수 함수)
├── collaboration/
│   └── plugins/markdown/
│       └── markdown-section-projector.ts  # sectionIndex Y.Map 관리
└── test/unit/
    ├── markdown-section-index.test.ts     # Section offset 단위 테스트
    └── markdown-section-update.test.ts    # 증분 Y.Text 적용 단위 테스트

src/main/java/com/smarterd/
└── collaboration/
    └── plugin/
        └── markdown/
            └── MarkdownScopeResolver.java  # BE section scope 해석
```

### Pattern 1: Section Index 계산

**What:** heading 줄 번호/문자 offset → section 경계 배열 계산
**When to use:** 에디터 변경 발생 시 어떤 section에 속하는지 판별할 때

```typescript
// Source: 설계 문서 02-편집-모델.md + 기존 extractHeadingItems 패턴
export interface SectionBoundary {
  /** heading offset (body 내 character offset) */
  startOffset: number;
  /** 다음 section 시작 offset (마지막 section은 body.length) */
  endOffset: number;
  /** 안정적 section ID — slug 기반, 충돌 시 -1/-2 접미사 */
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
 * @param body markdown 본문 (frontmatter 제외)
 * @returns section 경계 배열 (순서 보장)
 */
export function computeSectionBoundaries(body: string): SectionBoundary[] { ... }

/**
 * 변경된 offset이 속하는 section ID를 반환한다.
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

### Pattern 2: diff-match-patch를 Y.Text.applyDelta()로 변환

**What:** 텍스트 diff 결과를 Y.Text 부분 업데이트 연산으로 변환
**When to use:** section 범위 내 Y.Text 증분 적용

```typescript
// Source: 설계 문서 03-플러그인-통합.md "markdown:body-replace의 Y.Text 최적화"
import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from 'diff-match-patch';

/**
 * 이전/현재 텍스트 diff를 Y.Text 연산(Delta)으로 변환하여 적용한다.
 * section offset 범위 내에서만 동작한다.
 *
 * @param yText 대상 Y.Text
 * @param prevText 이전 텍스트
 * @param nextText 변경된 텍스트
 */
export function applyIncrementalTextUpdate(
  yText: Y.Text,
  prevText: string,
  nextText: string,
): void {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(prevText, nextText);
  dmp.diff_cleanupSemantic(diffs);

  let cursor = 0;
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

### Pattern 3: Section HTML 캐시 (증분 프리뷰)

**What:** section ID → HTML 캐시 Map, 변경된 section만 Worker 재요청
**When to use:** `useMarkdownPreview` 훅 확장

```typescript
// Source: 설계 문서 08-후속-phase-로드맵.md Phase 9-B + 기존 useMarkdownPreview.ts 패턴

interface SectionPreviewCache {
  /** section ID → sanitized HTML */
  htmlCache: Map<string, string>;
  /** 현재 section 순서 (순서 변경 감지용) */
  sectionOrder: string[];
}

/**
 * section 단위 증분 프리뷰를 관리한다.
 * 변경된 section만 Worker에 재렌더링 요청하고 나머지는 캐시를 유지한다.
 *
 * @param body markdown 본문
 * @param changedSectionIds 이번 변경에서 영향받은 section ID 집합
 * @returns 전체 프리뷰 HTML (section 순서대로 조합)
 */
export function useMarkdownSectionPreview(
  body: string,
  changedSectionIds: Set<string>,
): string { ... }
```

### Pattern 4: MarkdownScopeResolver (백엔드 신규)

**What:** `markdown:section-update` 커맨드의 `section/{id}` scope 해석
**When to use:** BE에서 커맨드 처리 시 scope lock 결정

```java
// Source: 설계 문서 03-플러그인-통합.md ScopeResolver 섹션
package com.smarterd.collaboration.plugin.markdown;

import com.smarterd.collaboration.plugin.ScopeRef;
import com.smarterd.collaboration.plugin.ScopeResolver;
import com.smarterd.collaboration.plugin.ScopeLockMode;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * markdown document command를 section/document scope로 해석한다.
 */
public class MarkdownScopeResolver implements ScopeResolver {

    private static final String SECTION_UPDATE_KEY = "markdown:section-update";
    private static final String BODY_REPLACE_KEY = "markdown:body-replace";
    private static final String FRONTMATTER_UPDATE_KEY = "markdown:frontmatter-update";

    @Override
    @NonNull
    public Collection<ScopeRef> resolve(@NonNull String commandKey, @Nullable Map<String, ?> payload) {
        return switch (commandKey) {
            case SECTION_UPDATE_KEY -> {
                final var sectionId = payload != null ? payload.get("sectionId") : null;
                if (!(sectionId instanceof String sid) || sid.isBlank()) {
                    yield List.of(rootScope());
                }
                yield List.of(new ScopeRef("section", sid, ScopeLockMode.EXCLUSIVE));
            }
            case BODY_REPLACE_KEY, FRONTMATTER_UPDATE_KEY -> List.of(rootScope());
            default -> List.of(rootScope());
        };
    }

    private static ScopeRef rootScope() {
        return new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE);
    }
}
```

### Anti-Patterns to Avoid

- **전체 재계산 후 전체 교체:** section이 변경되지 않았는데도 전체 Y.Text를 delete→insert하는 기존 패턴은 이 Phase에서 제거 대상이다. 단, heading 추가/삭제 등 구조 변경 시에는 fallback으로 유지한다.
- **Section ID에 index 사용:** `heading-{index}-{slug}` 패턴은 heading 추가 시 모든 이후 section ID가 변경된다. slug 기반 ID + 충돌 해소 접미사로 안정성을 확보해야 한다.
- **캐시 무효화 누락:** section 경계가 변경될 때 (heading 추가/삭제/이동) 전체 캐시를 무효화하지 않으면 stale HTML이 표시된다.
- **Worker에서 전체 body 재파싱:** 증분 프리뷰의 목적을 무력화한다. section 텍스트만 Worker에 전달해야 한다.
- **코어 수정:** `DocumentStore`, `ChangeBus`, `DocumentStore`, `CollaborationRuntime` 등 코어 모듈을 수정하는 것은 "코어 수정 제로" 원칙 위반이다.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 텍스트 diff 계산 | 직접 LCS/diff 구현 | `diff-match-patch` | Google 제작, edge case 처리 완성도, Y.Text.applyDelta와 자연스럽게 매핑 |
| Y.Text 증분 적용 | delete(0, all) + insert(0, all) | diff-match-patch diff → 범위 delete/insert | CRDT 이점 보존, 동시 편집 병합 품질 유지 |
| Section HTML 렌더링 | 새 렌더러 구현 | 기존 `marked` + `DOMPurify` (Worker 내부 재사용) | 이미 Worker에 완성된 파이프라인 존재 |
| section ID 생성 | 자체 UUID | slug 기반 ID (`slugify(headingText)` + 충돌 -1/-2) | 사람이 읽을 수 있고, heading 텍스트 변경 시만 ID 변경됨 |

**Key insight:** Y.Text의 CRDT는 문자 단위 병합을 자동으로 처리한다. 핵심 과제는 "어떤 section이 변경됐는가"를 정확히 식별하고, Y.Text의 올바른 offset 범위에만 적용하는 것이다. diff-match-patch가 이 계산을 대신한다.

---

## Common Pitfalls

### Pitfall 1: Section ID 불안정성

**What goes wrong:** heading 추가/삭제 시 index 기반 section ID가 모두 shift되어 Wrong section에 커맨드가 적용된다.
**Why it happens:** 현재 `extractHeadingItems()`의 `heading-{index}-{slug}` 패턴은 index를 포함한다.
**How to avoid:** `computeSectionBoundaries()`에서 slug 기반 ID를 사용하고, 같은 slug가 여러 번 등장할 때만 `-1`, `-2` 접미사를 추가한다. Section 구조 변경(heading 추가/삭제) 감지 시 `markdown:body-replace` fallback을 사용한다.
**Warning signs:** 다른 section 편집 내용이 엉뚱한 section에 반영되는 경우.

### Pitfall 2: Heading 추가/삭제 시 section 경계 오판

**What goes wrong:** 사용자가 새 heading `## 새 섹션`을 추가하면 그 이후 모든 section의 startOffset이 변경된다. sectionIndex가 갱신되기 전에 커맨드가 발행되면 Wrong offset에 적용된다.
**Why it happens:** section 경계 계산이 실시간으로 되지 않고, 이전 sectionIndex 스냅샷을 참조하는 경우.
**How to avoid:** `findAffectedSection()` 호출 전에 반드시 현재 draft 텍스트를 기준으로 `computeSectionBoundaries()`를 재계산한다. Heading 추가/삭제 감지 로직에서는 즉시 `markdown:body-replace` fallback으로 전환한다.
**Warning signs:** 변경 적용 후 문서 구조가 깨지는 경우.

### Pitfall 3: Y.Text transact 외부에서 부분 적용

**What goes wrong:** `Y.Text.delete()` + `Y.Text.insert()`를 transact 없이 순차 호출하면 중간 상태가 원격에 전파된다.
**Why it happens:** 기존 `replaceBuffer()`는 `doc.transact(() => { ... }, origin)`으로 감싸져 있지만, 신규 증분 적용 경로에서 transact를 누락하기 쉽다.
**How to avoid:** `applyIncrementalTextUpdate()`는 항상 `Y.Doc.transact()` 내부에서 호출되어야 한다. `MarkdownYjsDocumentAdapter`에서 transact를 보장한다.
**Warning signs:** 원격 클라이언트에서 부분 적용 상태가 보이는 경우.

### Pitfall 4: Worker section 요청과 캐시 순서 불일치

**What goes wrong:** 여러 section이 빠르게 연속 변경되면 Worker 응답 순서가 요청 순서와 다를 수 있다. 이전 응답이 최신 응답을 덮어쓸 수 있다.
**Why it happens:** Web Worker는 비동기이고, 기존 `useMarkdownPreview`의 `requestIdRef.current` 패턴은 단일 요청만 처리한다.
**How to avoid:** section별 requestId를 Map으로 관리하고, 응답의 sectionId + requestId가 현재 최신 요청과 일치하는 경우에만 캐시를 갱신한다.
**Warning signs:** 프리뷰가 깜빡이거나 이전 내용으로 되돌아가는 경우.

### Pitfall 5: remote-pending 배너의 section-aware 판단 오류

**What goes wrong:** 원격 변경이 다른 section에 있음에도 3버튼 배너가 표시되어 사용자를 불필요하게 방해한다.
**Why it happens:** D-07(다른 section 자동 수락) 로직을 구현하지 않고 기존 remote-pending 전체 문서 비교로 처리하는 경우.
**How to avoid:** 원격 변경 수신 시 변경된 section ID와 현재 사용자가 편집 중인 section ID를 비교한다. 다른 section이면 자동 수락, 같은 section이면 3버튼 UI를 표시한다.
**Warning signs:** 다른 section 편집 시 항상 remote-pending 배너가 표시되는 경우.

---

## Code Examples

### 기존 동기화 경로 (교체 대상)

```typescript
// Source: client/src/pages/document/use-markdown-document-session.ts
// 현재: 모든 편집에서 markdown:body-replace 발행 → 전체 Y.Text 교체
const setEditorBuffer = useCallback(
  (nextBuffer: string) => {
    documentMutationSession.emitCommand(
      { key: 'markdown:body-replace', payload: { buffer: nextBuffer } },
      { origin: { source: 'local' } },
    );
  },
  [collaborationReady, documentMutationSession],
);
```

### 기존 replaceBuffer (증분 교체 대상 부분)

```typescript
// Source: client/src/collaboration/yjs/markdown-yjs-document-adapter.ts
// 현재: body가 다르면 항상 전체 delete + insert
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
```

### Section-Update 적용 경로 (신규)

```typescript
// Source: 설계 문서 03-플러그인-통합.md MarkdownMutationPolicy
// markdown:section-update 커맨드 payload 구조
{
  pluginId: 'markdown',
  key: 'markdown:section-update',
  payload: {
    sectionId: 'api-설계',     // section scope ID
    sectionText: '## API 설계\n\n수정된 내용',  // 변경된 section 전체 텍스트
    startOffset: 120,           // body 내 section 시작 offset
    endOffset: 280,             // body 내 section 종료 offset
  },
}
```

### MarkdownDocumentMutationApplier 수정 방향

```typescript
// Source: client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts
// 현재 section-update case는 applyBufferReplace()로 위임 (전체 교체와 동일)
// 수정: offset 기반 증분 적용으로 교체
case 'markdown:section-update':
  return this.toApplyResult(this.applySectionUpdate(mutation));  // 신규 메서드

private applySectionUpdate(mutation: DocumentMutation): boolean {
  const { sectionId, sectionText, startOffset, endOffset } = mutation.payload ?? {};
  // ... 검증 후 applyIncrementalTextUpdate 호출
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 전체 Y.Text delete→insert | diff-match-patch 범위 update | 이 Phase | CRDT 병합 품질 향상, 네트워크 전송량 감소 |
| 전체 HTML 재렌더링 | Section HTML 캐시 Map | 이 Phase | 변경된 section만 Worker 재요청 |
| `document/root` 단일 scope | `section/{id}` scope 활성화 | 이 Phase | 다른 section 편집 사용자 간 scope 분리 |
| heading index 기반 ID | slug 기반 안정적 ID | 이 Phase | heading 추가/삭제 시 기존 section ID 보존 |

**Deprecated/outdated:**
- `applyBufferReplace()` 내 `markdown:section-update` 위임: 이 Phase에서 독립적 증분 적용 메서드로 교체
- `heading-{index}-{slug}` ID 생성: Section Index Projector에서 slug 전용 ID로 교체

---

## Open Questions

1. **Section ID와 heading text 변경 시 처리**
   - What we know: slug 기반 ID를 사용하면 heading 텍스트 변경 시 section ID가 변경된다.
   - What's unclear: 같은 section을 편집하는 두 사용자 중 한 명이 heading 텍스트를 수정하면 다른 사용자의 sectionId가 invalid해진다.
   - Recommendation: heading 텍스트 변경 시 `markdown:body-replace` fallback을 사용한다. Section-update는 heading 아래 body 내용 변경에만 적용한다.

2. **`useMarkdownPreview` 시그니처 확장 방식**
   - What we know: 현재 `useMarkdownPreview(body: string): string` 시그니처는 전체 body를 받아 전체 HTML을 반환한다.
   - What's unclear: 증분 프리뷰를 위해 `changedSectionIds`를 외부에서 전달받아야 하는데, 이 정보의 출처(에디터 변경 감지 vs sectionIndex 비교)를 어디서 계산할지 결정이 필요하다.
   - Recommendation: `MarkdownDocumentPage`에서 이전/현재 sectionBoundaries를 비교하여 changedSectionIds를 계산하고 새 훅 `useMarkdownSectionPreview`에 전달한다. 기존 `useMarkdownPreview`는 하위 호환으로 유지한다.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 단위 테스트 (`node:test`) | ✓ | 20.15.1 | — |
| npm | 패키지 설치 | ✓ | 10.7.0 | — |
| diff-match-patch | 증분 diff 계산 | ✗ (미설치) | — | 설치 필요: `npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd` |
| yjs | Y.Text CRDT | ✓ | 13.6.29 | — |
| marked | Section HTML 렌더링 (Worker) | ✓ | 14.0.0 | — |

**Missing dependencies with no fallback:**
- `diff-match-patch`: Wave 0에서 설치 필요. 증분 Y.Text 적용의 핵심 의존성.

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
| DOC-01 | Section 경계 계산 정확성 | unit | `npm run test:unit` (markdown-section-index.test.ts) | ❌ Wave 0 |
| DOC-01 | 단일 section 변경 → section-update 커맨드 발행 | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-01 | heading 추가/삭제 시 body-replace fallback | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-01 | diff-match-patch → Y.Text 증분 적용 정확성 | unit | `npm run test:unit` (markdown-section-update.test.ts) | ❌ Wave 0 |
| DOC-02 | 변경 section만 캐시 무효화 (나머지 캐시 보존) | unit | `npm run test:unit` (markdown-section-preview.test.ts) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd client && npm run test:unit`
- **Per wave merge:** `cd client && npm run test:unit`
- **Phase gate:** 전체 단위 테스트 통과 후 `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `client/test/unit/markdown-section-index.test.ts` — REQ DOC-01: Section 경계 계산
- [ ] `client/test/unit/markdown-section-update.test.ts` — REQ DOC-01: 증분 Y.Text 적용
- [ ] `client/test/unit/markdown-section-preview.test.ts` — REQ DOC-02: Section HTML 캐시

---

## Sources

### Primary (HIGH confidence)

- `plan/2026-03-26-마크다운-에디터-플러그인-설계/08-후속-phase-로드맵.md` — Phase 7 + Phase 9-B 구현 범위 (설계 원본)
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/02-편집-모델.md` — buildCommands 전략, section-update 커맨드 정의
- `plan/2026-03-26-마크다운-에디터-플러그인-설계/03-플러그인-통합.md` — ScopeResolver, MutationPolicy, MarkdownMutationPolicy Y.Text 최적화
- `client/src/collaboration/yjs/markdown-yjs-document-adapter.ts` — 현재 Y.Text 교체 구현
- `client/src/collaboration/plugins/markdown/markdown-document-mutation-applier.ts` — 현재 mutation 적용 경로
- `client/src/hooks/useMarkdownPreview.ts` — Phase 9-A Worker 파이프라인 (확장 기반)
- `client/src/pages/document/use-markdown-document-session.ts` — body-replace 발행 경로

### Secondary (MEDIUM confidence)

- npm registry: `diff-match-patch@1.0.5`, `@types/diff-match-patch@1.0.36` — 버전 확인

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — diff-match-patch는 설계 문서에서 명시 선택, npm registry로 버전 확인
- Architecture: HIGH — 기존 코드베이스를 직접 분석하여 수정 대상 파악
- Pitfalls: HIGH — 기존 Yjs 사용 패턴 + 설계 문서의 구현 주의사항 기반

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (diff-match-patch API 안정적, 설계 문서 고정)
