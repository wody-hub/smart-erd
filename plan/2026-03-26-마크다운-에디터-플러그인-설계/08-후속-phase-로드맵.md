# 08. 후속 Phase 로드맵 (2026-04-02 기준)

## 배경

마크다운 에디터 플러그인 1차 구현(로드맵 1~5단계)이 완성되었고, 코드 리뷰(Claude 구조적 리뷰 + Codex GPT-5.4 적대적 리뷰)를 통해 1차 구현의 설계 한계 4건이 식별되었다.

4건 모두 설계 문서(`06-구현-로드맵.md`)에서 이미 인지하고 있는 "점진적 복잡도" 전략의 의도된 한계이며, 후속 phase에서 해결해야 한다.

---

## 식별된 구조적 한계

| # | 심각도 | 출처 | 현상 | 영향 |
|---|--------|------|------|------|
| L1 | HIGH | Codex | Frontmatter YAML 파싱 실패 시 silent data loss | 사용자가 frontmatter를 잘못 편집하면 메타데이터 영구 소실 |
| L2 | HIGH | Codex | 전체 문서 교체 방식의 Y.Text 동기화 (delete-all/insert-all) | 동시 편집 시 CRDT 병합 품질 저하, O(문서크기) 네트워크 비용 |
| L3 | MEDIUM | Codex | 문서 허브 목록에서 전체 content 로드 + markdown 파싱 | 대용량 문서 프로젝트에서 목록 API 지연 |
| L4 | MEDIUM | Codex | 프리뷰 렌더링이 매 변경마다 전체 문서 동기 파싱 | 대용량 문서에서 타이핑 지연 |

---

## Phase 6: Frontmatter 안전성 강화

**목표:** YAML 파싱 실패가 메타데이터를 영구적으로 지우지 않도록 방어

**선행 조건:** 없음 (독립 작업)

### 구현 범위

1. **파싱 실패 시 원본 보존**
   - `markdown.ts:parseMarkdownBuffer()` — YAML 파싱 실패 시 `{}`로 대체하는 대신 원본 frontmatter 텍스트를 보존
   - 기존 `ParsedMarkdownBuffer.frontmatterText: string | null` 필드를 활용하여 파싱 실패 시에도 원본 유지 (신규 필드 추가 불필요)
   - `frontmatterValid: boolean` 플래그를 추가하여 파싱 성공/실패를 명시적으로 구분
   - 직렬화 시 파싱 실패 상태면 `frontmatterText` 원본을 그대로 출력

2. **DraftState 연동**
   - dirty-invalid 상태에서 frontmatter 파싱 실패 시 Y.Doc에 커밋하지 않음 (기존 DraftState 계약 활용)
   - 에디터 인라인 경고로 "frontmatter YAML 구문 오류" 표시

3. **Yjs adapter 방어**
   - `markdown-yjs-document-adapter.ts:replaceBuffer()` — frontmatter가 파싱 불가능한 상태면 Y.Map("frontmatter") 업데이트 스킵
   - 기존 Y.Map 값을 유지하고 body만 업데이트

### 검증 기준

- [ ] `title: API: Auth` (콜론이 포함된 YAML)를 입력해도 기존 frontmatter가 보존된다
- [ ] YAML 파싱 실패 시 하단 상태 바에 경고가 표시된다
- [ ] 파싱 실패 상태에서 저장/동기화되어도 기존 메타데이터가 유지된다
- [ ] 파싱 성공 시 정상적으로 frontmatter가 업데이트된다

### 예상 규모

| 구분 | 수정 파일 | 추가 라인 |
|------|----------|----------|
| 파서 | `markdown.ts` | ~30줄 |
| 어댑터 | `markdown-yjs-document-adapter.ts` | ~15줄 |
| 상태 표시 | `MarkdownStatusStrip.tsx` | ~10줄 |
| 테스트 | `markdown-parser.test.ts` | ~40줄 |

---

## Phase 7: 증분 동기화 (Section-Update)

**목표:** 전체 문서 교체(delete-all/insert-all)를 섹션 단위 증분 업데이트로 전환

**선행 조건:**
- Phase 6 완료 (frontmatter 보존 로직이 증분 적용의 전제)
- `diff-match-patch` 패키지 설치 (`npm install diff-match-patch @types/diff-match-patch --cache /tmp/npm-cache-smarterd`)

### 구현 범위

1. **Section Index Projector**
   - heading 기반 section offset 매핑 (`Y.Map("sectionIndex")`)
   - Projector가 Y.Text 변경 시 자동으로 sectionIndex 갱신
   - heading 추가/삭제/이동 시 index 재계산

2. **diff-match-patch 증분 적용**
   - `markdown-yjs-document-adapter.ts` — 전체 삭제/삽입 대신 `diff-match-patch`로 변경 범위만 Y.Text에 적용
   - 변경 영역이 단일 section 내에 있으면 `markdown:section-update` 커맨드 사용
   - section 경계를 넘는 변경은 `markdown:body-replace` 유지 (fallback)

3. **ScopeResolver 확장**
   - `section/{id}` scope 활성화 (현재 `document/root` 단일 scope)
   - heading 기반 section ID 할당
   - 같은 section을 편집하는 두 사용자는 Y.Text CRDT 문자 단위 병합
   - 다른 section을 편집하는 사용자는 scope lock으로 충돌 방지

4. **Remote-pending 정교화**
   - section-aware remote-pending 배너
   - 변경이 다른 section에 있으면 자동 수락 (충돌 없음)
   - 같은 section에 있으면 3버튼 UI 유지

### 검증 기준

- [ ] 두 사용자가 다른 section을 동시 편집할 때 각자의 변경이 정상 반영된다
- [ ] 같은 section 편집 시 문자 단위 CRDT 병합이 동작한다
- [ ] heading 추가/삭제 시 sectionIndex가 자동 갱신된다
- [ ] 1,000줄 문서에서 단일 section 편집 시 네트워크 payload가 해당 section 크기에 비례한다
- [ ] section 경계를 넘는 편집(heading 레벨 변경 등)이 정상 처리된다

### 예상 규모

| 구분 | 수정/신규 파일 | 추가 라인 |
|------|--------------|----------|
| 패키지 | `diff-match-patch`, `@types/diff-match-patch` 설치 | — |
| Section Index | `markdown-scope-resolver.ts`, `markdown-projector.ts` (신규) | ~120줄 |
| 증분 적용 | `markdown-yjs-document-adapter.ts`, `markdown-document-mutation-applier.ts` (수정) | ~150줄 |
| Scope 확장 | BE `MarkdownScopeResolver.java` (신규) | ~40줄 |
| Remote-pending | `RemotePendingBanner.tsx` (수정) | ~30줄 |
| 테스트 | 단위 + E2E | ~200줄 |

---

## Phase 8: 허브 목록 성능 최적화

**목표:** 문서 허브 목록 API가 문서 개수에만 비례하고, content 크기에는 비례하지 않도록 개선

**선행 조건:** 없음 (독립 작업)

### 구현 범위

1. **DB 레벨 — summary 컬럼 도입**
   - `diagrams` 테이블에 `template_key`, `summary_text` 컬럼 추가
   - 마이그레이션: 기존 markdown 문서의 content에서 추출하여 backfill
   - 문서 저장 시 `MarkdownDocumentDescriptorService`가 추출한 값을 컬럼에 동기화

2. **Repository — 목록용 프로젝션**
   - `DiagramRepository`에 목록 전용 프로젝션 인터페이스 추가
   - `content`, `ydoc_snapshot` 제외, `template_key`, `summary_text` 포함
   - `getDiagrams()` 메서드가 프로젝션 사용하도록 전환

3. **서비스 — 런타임 파싱 제거**
   - `toDiagramSummaryResult()`에서 `describeMarkdown()` 호출 제거
   - DB 컬럼에서 직접 읽기

### 검증 기준

- [ ] 문서 허브 목록 API 응답에 `templateLabel`, `summaryText`가 정상 포함된다
- [ ] 목록 API SQL에 `content` 컬럼이 포함되지 않는다 (실행 SQL 로그 확인)
- [ ] 100개 markdown 문서(각 10KB) 프로젝트에서 목록 API 응답 시간이 100ms 이내
- [ ] 문서 저장 시 summary 컬럼이 자동 갱신된다

### 예상 규모

| 구분 | 수정/신규 파일 | 추가 라인 |
|------|--------------|----------|
| 마이그레이션 | `V{날짜}__diagram_summary_columns.sql` | ~15줄 |
| Entity | `Diagram.java` | ~10줄 |
| Repository | `DiagramRepository.java`, `DiagramRepositoryCustomImpl.java` | ~30줄 |
| Service | `DiagramService.java` | ~10줄 (삭제 위주) |
| 테스트 | `DiagramServiceTest.java` | ~30줄 |

---

## Phase 9: 프리뷰 렌더링 최적화

**목표:** 대용량 문서에서 타이핑 지연 없이 실시간 프리뷰 제공

**선행 조건:**
- 없음 (비동기 Worker 이전은 독립 구현 가능)
- Phase 7 완료 권장 (증분 프리뷰 구현 시 section index 필요)

### 구현 범위

1. **비동기 프리뷰 파이프라인** (Phase 7 없이 독립 구현 가능)
   - `marked.parse` + `DOMPurify.sanitize`를 Web Worker로 이전
   - 메인 스레드는 편집에만 집중, 프리뷰는 Worker 결과를 비동기 수신
   - 300ms debounce 적용 (DraftState debounce와 동일)

2. **증분 프리뷰** (Phase 7 section index 필요)
   - Phase 7의 section index를 활용하여 변경된 section만 재렌더링
   - 나머지 section은 캐시된 HTML 유지
   - section 경계 변경 시 전체 재렌더링 fallback

3. **가상 스크롤 (대용량)**
   - 5,000줄+ 문서에서 프리뷰 영역에 가상 스크롤 적용
   - 뷰포트에 보이는 section만 DOM에 마운트

### 검증 기준

- [ ] 1,000줄 문서에서 타이핑 지연이 16ms(60fps) 이내
- [ ] 프리뷰 갱신이 300ms 이내에 반영된다
- [ ] Worker 에러 시 메인 스레드 fallback으로 프리뷰 유지

### 예상 규모

| 구분 | 수정/신규 파일 | 추가 라인 |
|------|--------------|----------|
| Worker | `markdown-preview-worker.ts` (신규) | ~60줄 |
| 훅 | `use-markdown-preview.ts` (신규) | ~50줄 |
| 페이지 | `MarkdownDocumentPage.tsx` | ~20줄 수정 |
| 테스트 | `markdown-preview-worker.test.ts` | ~40줄 |

---

## 전체 Phase 의존 관계

```text
[Phase 1~5: 1차 구현 완료] ✅
        │
        ├── Phase 6: Frontmatter 안전성 ─────────────────── 독립
        │       │
        │       └── Phase 7: 증분 동기화 ──────── Phase 6 선행 필요
        │               │
        │               └── Phase 9-B: 증분 프리뷰 ── Phase 7 선행 필요
        │
        ├── Phase 8: 허브 목록 최적화 ───────────────────── 독립
        │
        └── Phase 9-A: 비동기 Worker 프리뷰 ─────────────── 독립
```

## Phase 우선순위 및 일정

| Phase | 내용 | 우선순위 | 예상 기간 | 선행 |
|-------|------|----------|----------|------|
| **6** | Frontmatter 안전성 강화 | P1 (데이터 무결성) | 2~3일 | 없음 |
| **7** | 증분 동기화 (Section-Update) | P1 (협업 품질) | 1~2주 | Phase 6, `diff-match-patch` 설치 |
| **8** | 허브 목록 성능 최적화 | P2 (성능) | 2~3일 | 없음 |
| **9** | 프리뷰 렌더링 최적화 | P3 (UX) | 3~5일 | 비동기 Worker: 없음 / 증분 프리뷰: Phase 7 |

### 권장 실행 순서

```text
Phase 6 (2~3일)  →  Phase 7 (1~2주)  →  Phase 9-B 증분 프리뷰 (2~3일)
Phase 8 (2~3일)  ─── 독립 병렬 가능
Phase 9-A 비동기 Worker (2~3일) ─── 독립 병렬 가능
```

Phase 6, 8, 9-A는 서로 독립이므로 병렬 진행 가능. Phase 7은 가장 규모가 크고 협업 품질에 직접 영향하므로 Phase 6 바로 다음에 진행한다. Phase 9-A(Worker 이전)는 Phase 7 없이도 즉시 시작 가능하다.

---

## 후속 Phase에 포함하지 않는 항목

아래 항목은 기존 `06-구현-로드맵.md`의 Phase 6(후속)에 이미 정의되어 있으며, 이 문서의 범위에 포함하지 않는다.

- 이미지 업로드 / asset runtime 연계
- 문서 API/경로 naming 정리 (`diagram` → `document`)
- PDF export renderer 전략 확정 및 구현
- WYSIWYG 블록 에디터
- 댓글/리뷰 시스템
