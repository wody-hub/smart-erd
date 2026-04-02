---
phase: 01
reviewers: [gemini, codex]
reviewed_at: "2026-04-02T15:30:00Z"
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 1: 마크다운 증분 동기화

## Gemini Review

Smart-ERD 프로젝트의 **Phase 1: 마크다운 증분 동기화** 완료된 실행 계획에 대한 검토 결과입니다.

---

### 1. 종합 평가 (Summary)
Phase 1의 설계는 마크다운 문서의 협업 효율성을 극대화하기 위해 **섹션 단위의 스코프 분리**와 **증분 렌더링 캐시**라는 핵심 전략을 잘 수립했습니다. 특히 인덱스가 아닌 슬러그(Slug) 기반의 섹션 ID를 사용하여 문서 구조 변경에 유연하게 대응하도록 설계된 점과, `diff-match-patch`를 활용해 Yjs 트랜잭션의 부하를 최소화하려는 접근이 매우 인상적입니다. 전체적으로 동기화 성능과 사용자 경험(UX) 간의 균형을 잘 맞춘 수준 높은 계획입니다.

### 2. 주요 강점 (Strengths)
*   **슬러그 기반 섹션 식별 (D-01, Plan 01-01):** 배열 인덱스가 아닌 내용 기반 ID를 사용하여, 상단 섹션이 추가/삭제되어도 하단 섹션의 ID가 유지되도록 설계하여 동기화 안정성을 높였습니다.
*   **계층적 동기화 전략 (Plan 01-03):** 단순 텍스트 변경은 `section-update`로 처리하고, 문서 구조(Heading) 변경 시에만 `body-replace`로 폴백(Fallback)하는 이중 전략이 효율적입니다.
*   **Worker 기반 증분 프리뷰 (Plan 01-04):** 변경된 섹션만 Worker에서 변환하고 나머지는 HTML 캐시를 사용하는 구조는 대용량 문서 편집 시 메인 스레드 차단을 방지하는 최적의 선택입니다.
*   **정교한 충돌 해결 UX (D-07, D-08):** 다른 섹션의 변경은 무중단(자동 수락)으로 처리하고, 동일 섹션 충돌 시에만 UI를 노출하여 협업 흐름의 단절을 최소화했습니다.

### 3. 우려 사항 및 리스크 (Concerns)

*   **섹션 ID 충돌 및 모호성 (Severity: MEDIUM):** 동일한 제목의 Heading이 여러 개 존재할 경우 `-1`, `-2` 접미사를 붙이는 방식은 일시적인 해결책은 되나, 두 사용자가 동시에 같은 제목을 입력할 경우 슬러그 생성 로직이 충돌할 수 있습니다.
*   **마크다운 문법의 다양성 대응 (Severity: LOW):** ATX 스타일(`# Heading`) 외에 Setext 스타일(`Heading\n===`)이나 코드 블록 내의 `#` 기호 등이 섹션 경계 판정 로직(`computeSectionBoundaries`)에서 오탐을 일으킬 가능성이 있습니다.
*   **메모리 관리 리스크 (Severity: LOW):** `SectionPreviewCache`가 Map 형태로 유지될 때, 장시간 편집이나 매우 큰 문서의 경우 불필요해진 이전 섹션의 HTML 캐시가 메모리를 점유할 수 있습니다.
*   **백엔드 스코프 권한 검증 (Severity: MEDIUM):** `MarkdownScopeResolver`에서 `section/{id}` 단위로 EXCLUSIVE 스코프를 제공할 때, 클라이언트가 악의적으로 다른 섹션의 ID를 보내거나 전체 문서를 락킹하는 행위에 대한 검증 로직이 계획상 명확하지 않습니다.

### 4. 개선 제안 (Suggestions)

*   **결정적 ID 생성 보완:** 슬러그 생성 시 단순히 제목뿐만 아니라, Yjs의 `ClientID`나 생성 시점의 타임스탬프를 조합하여 분산 환경에서도 고유성이 보장되는 ID 체계를 검토하십시오.
*   **섹션 파싱 Edge Case 테스트 강화:** 코드 블록, 인용문 내의 Heading 레이아웃 등에 대한 정규표현식 예외 케이스를 TDD 스캐폴드에 반드시 포함해야 합니다.
*   **캐시 만료 정책 도입:** `SectionPreviewCache` 구현 시 현재 문서에 존재하지 않는 섹션 ID에 대해서는 가비지 컬렉션(GC)을 수행하는 로직을 추가하는 것이 좋습니다.
*   **Selective Hydration 검토:** 프리뷰 영역이 매우 길 경우, 변경된 섹션뿐만 아니라 현재 사용자의 뷰포트에 있는 섹션을 우선적으로 렌더링하는 전략을 추후 고려할 수 있습니다.

### 5. 리스크 평가 (Risk Assessment)

**리스크 수준: LOW (낮음)**

계획이 매우 구체적이며, 특히 Yjs의 `transact` 활용과 Worker를 통한 성능 최적화 등 기술적 난도가 높은 부분에 대한 대비가 잘 되어 있습니다. 언급된 우려 사항들은 대부분 구현 단계의 세부 예외 처리로 해결 가능하며, 아키텍처의 근간을 흔들 정도의 치명적인 결함은 발견되지 않았습니다.

---

## Codex Review

### Plan 01-01: Section Index 순수 함수 라이브러리

**Summary:** 핵심 primitive를 먼저 분리한 판단은 좋습니다. 다만 "section이 무엇인가"를 정규식 기반 ATX heading으로 사실상 고정해버려서, 이후 모든 wave가 이 단순화된 모델에 종속되는 구조가 되었습니다.

**Strengths:**
- 순수 함수와 TDD로 시작해서 후속 wave의 의존성을 명확히 만든 점
- slug 기반 section ID와 root section 개념을 초기에 고정한 것
- 테스트 스캐폴드를 Wave 1에서 미리 만든 것

**Concerns:**
- [HIGH] section 경계 정의가 ATX heading만 인정 — setext heading, fenced code block 내 `#`, blockquote 내 heading 미처리
- [MEDIUM] nested heading semantics 미정의 (H2/H3 계층 vs 선형 분할)
- [MEDIUM] slug 기반 ID가 heading rename, duplicate heading에 민감 — section ID churn으로 증분 이점 감소
- [LOW] 테스트 범위가 단순 예제 중심 (setext, code fence 오탐, CRLF 혼합 케이스 부재)

**Risk:** MEDIUM

### Plan 01-02: 백엔드 ScopeResolver + Plugin

**Summary:** plugin/scope 책임 분리는 깔끔하지만 payload 검증과 FE/BE 해석 일관성이 부족합니다.

**Concerns:**
- [HIGH] validation hook이 비어 있음 — sectionId, offset 정합성 검증 없음
- [MEDIUM] D-03(CRDT 병합 허용)과 EXCLUSIVE scope의 관계가 모호
- [MEDIUM] FE/BE scope resolver 이중 구현으로 drift 위험

**Risk:** MEDIUM

### Plan 01-03: FE 증분 동기화 핵심 경로

**Summary:** phase의 핵심 가치가 있지만 가장 큰 리스크도 있음. 절대 offset 기반 apply는 동시 편집에서 쉽게 흔들림.

**Concerns:**
- [HIGH] 절대 offset 기반 apply가 D-04와 충돌 — 앞쪽 section 길이 변경 시 뒤 section offset이 밀림
- [HIGH] RemotePendingBanner의 activeSectionId 공급이 미구현 가능성
- [MEDIUM] heading rename이 body-replace fallback으로 증분 이점 감소
- [MEDIUM] 알고리즘 계약이 느슨 (변경 section 수 1개 체크 수준)
- [LOW] same-section 충돌 시 CRDT 병합과 3버튼 배너 UX가 혼재

**Risk:** HIGH

### Plan 01-04: Section HTML 캐시 + 증분 프리뷰

**Summary:** DOC-02를 위한 캐시/worker 분리는 좋지만 section 독립 렌더링이 문서 전체 문맥을 잃을 수 있음.

**Concerns:**
- [MEDIUM] section 독립 렌더링이 reference-style link, TOC 등 전체 문맥 패턴과 충돌
- [MEDIUM] order 변경 시 preview 깜빡임 가능성
- [MEDIUM] cache key가 slug ID에 종속 — Plan 01-01의 ID churn 리스크 계승
- [LOW] 삭제된 section의 stale bookkeeping

**Risk:** MEDIUM

### 종합 판단: MEDIUM-HIGH

단순 ATX heading 문서와 낮은 충돌 빈도에서는 잘 작동하겠지만, 협업 강도가 올라가면 Plan 01-03의 절대 offset 문제가 가장 먼저 드러날 가능성이 큽니다.

---

## Consensus Summary

### Agreed Strengths
- **slug 기반 section ID** — 양쪽 모두 index 대신 content 기반 ID 사용을 긍정 평가
- **section-update/body-replace 이중 전략** — 구조 변경 시 안전한 fallback을 유지한 점
- **Worker 기반 증분 프리뷰** — 메인 스레드 차단 방지와 캐시 전략
- **D-07/D-08 충돌 UX** — 다른 section 자동 수락, 같은 section 배너의 정교한 분기

### Agreed Concerns
1. **[HIGH] Markdown grammar 커버리지** — ATX heading만 지원, setext/code fence/blockquote 내 heading 미처리 (Gemini: LOW, Codex: HIGH → 합의: MEDIUM-HIGH)
2. **[HIGH] 절대 offset 신뢰 문제** — 동시 편집 시 앞 section 변경이 뒤 section offset을 밀어 잘못된 범위에 diff 적용 가능 (Codex: HIGH)
3. **[MEDIUM] slug ID churn** — heading rename/duplicate 시 section ID가 불안정해져 증분 이점 감소 (양쪽 공통)
4. **[MEDIUM] BE payload 검증 부재** — validation hook이 비어 있어 잘못된 payload가 통과 (양쪽 공통)
5. **[MEDIUM] FE/BE scope resolver drift** — 이중 구현으로 일관성 유지 부담 (Codex)
6. **[MEDIUM] section 독립 렌더링 문맥 손실** — reference link, TOC 등 전체 문서 문맥이 필요한 패턴 (양쪽 공통)

### Divergent Views
- **전체 리스크 수준:** Gemini는 **LOW**, Codex는 **MEDIUM-HIGH**로 평가. Gemini는 아키텍처 견고성을 긍정 평가한 반면, Codex는 동시성 모델(절대 offset)과 section 모델(ATX only)의 한계를 더 무겁게 봄.
- **section ID 전략:** Gemini는 Yjs ClientID/timestamp 조합 제안, Codex는 persistent node identity 도입 제안. 접근 방향은 다르지만 현재 slug-only 전략의 보완 필요성에는 동의.
- **nested heading:** Codex만 계층 vs 선형 분할 의미론을 문제 삼음. Gemini는 언급하지 않음.

---

*Reviewed: 2026-04-02 by Gemini CLI + Codex CLI*
*Phase already implemented — reviews are retrospective for future phase improvement*
