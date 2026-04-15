---
phase: 01
reviewers: [gemini]
reviewed_at: 2026-04-03T12:00:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md, 01-06-PLAN.md, 01-07-PLAN.md]
note: Codex was invoked but timed out (spent 120s reading codebase without producing review output)
---

# Cross-AI Plan Review — Phase 01

## Gemini Review

Smart-ERD 프로젝트의 **Phase 01: markdown-incremental-sync** 구현 계획에 대한 검토 결과입니다. 전체적으로 설계의 완결성이 매우 높으며, 실시간 협업의 복잡한 엣지 케이스(동시 편집 시 offset 밀림, 메모리 누수, 파싱 오탐 등)를 사전에 식별하고 대응하는 'Gap Closure' 플랜들이 포함되어 있어 매우 신뢰할 수 있는 계획입니다.

---

## 1. 종합 평가 (Summary)

본 계획은 마크다운 에디터의 성능과 협업 안정성을 비약적으로 향상시키기 위한 체계적인 접근법을 제시합니다. 전체 문서를 교체하던 기존 방식에서 벗어나, **Section 단위의 증분 동기화(DOC-01)**와 **증분 프리뷰(DOC-02)**를 구현하기 위해 `diff-match-patch` 라이브러리와 Yjs의 `transact`를 영리하게 결합했습니다. 특히, 초기 계획 이후 리뷰 피드백을 반영한 **Gap Closure 플랜(05, 06, 07)**을 통해 동시 편집 시의 데이터 무결성과 시스템 안정성을 강화한 점이 돋보입니다.

---

## 2. 주요 강점 (Strengths)

*   **방어적 설계 (Defensive Design):** Plan 05에서 절대 offset 대신 `sectionId` 기반으로 경계를 재계산하는 로직을 추가하여, 실시간 협업 시 가장 빈번하게 발생하는 '문자열 위치 밀림' 문제를 근본적으로 차단했습니다.
*   **TDD 및 스캐폴딩 전략:** Plan 01에서 핵심 로직에 대한 TDD를 수행하고, 후속 플랜을 위한 테스트 스캐폴드를 미리 생성하여 병렬 개발 및 협업의 생산성을 높였습니다.
*   **안정적인 ID 체계:** Index 기반 ID 대신 `slug` 기반 ID를 채택하여, 문서 중간에 새로운 섹션이 추가되더라도 기존 섹션들의 ID가 유지되도록 설계함으로써 협업 충돌을 최소화했습니다.
*   **성능 최적화:** Web Worker 기반의 증분 렌더링(Plan 04)과 stale 응답을 방지하기 위한 `requestId` 매핑, 그리고 삭제된 섹션의 캐시를 정리하는 GC 로직(Plan 06) 등 성능과 메모리 관리에 세심한 주의를 기울였습니다.
*   **사용자 경험(UX) 배려:** D-07 결정에 따라 다른 섹션의 변경은 배너 없이 자동 수락하여 편집 흐름을 방해하지 않도록 설계한 점이 SI 프로젝트 관리 도구라는 성격에 잘 부합합니다.

---

## 3. 주요 우려 사항 (Concerns)

*   **[MEDIUM] 대용량 문서에서의 파싱 부하:** `setEditorBuffer`가 호출될 때마다(debounce 300ms) 전체 body에 대해 `computeSectionBoundaries`를 실행합니다. 수만 라인의 초대형 문서의 경우 메인 스레드에 미세한 지연이 발생할 수 있습니다.
*   **[LOW] Fenced Code Block 내 중첩 마커:** Plan 06에서 code block을 skip하는 로직이 포함되었으나, 마크다운 명세상 더 긴 marker(예: ` ```` `)를 사용하는 중첩 code block에 대한 처리가 정규식만으로 완벽할지 검증이 필요합니다.
*   **[LOW] 원격 변경 수신 시의 재파싱 빈도:** Plan 05에서 `applySectionUpdate` 시 매번 `computeSectionBoundaries`를 호출합니다. 원격 변경이 빈번하게 들어올 때 성능 저하 요인이 될 수 있습니다.

---

## 4. 제안 사항 (Suggestions)

*   **Boundary 계산 최적화:** 문서가 매우 클 경우를 대비하여, `computeSectionBoundaries` 결과를 캐싱하거나 변경된 부분 근처만 부분 파싱하는 로직을 향후 고도화 과제로 검토하십시오.
*   **Worker 렌더링 에러 핸들링:** Plan 04의 Worker에서 `marked.parse`가 특정 섹션의 문법 오류로 인해 실패할 경우, 해당 섹션만 '렌더링 실패' 메시지를 보여주거나 이전 캐시를 유지하는 등 폴백 처리를 명시하면 더욱 견고해질 것입니다.
*   **Monaco Editor 커서 동기화:** Plan 05에서 `activeSectionId`를 추적할 때, 단순히 `setEditorBuffer` 발생 시점뿐만 아니라 Monaco의 커서 이동(`onDidChangeCursorPosition`) 이벤트와 연동하여 현재 사용자가 보고 있는 섹션을 실시간으로 업데이트하면 자동 수락 UX가 더 정확해질 것입니다.

---

## 5. 리스크 평가 (Risk Assessment)

**Risk Level: LOW**

**사유:**
*   가장 큰 리스크였던 '동시 편집 시 offset 밀림' 문제를 Plan 05(Gap Closure)에서 `sectionId` 기반 재계산으로 해결했습니다.
*   섹션 구조가 변경되는 복잡한 케이스(Heading 추가/삭제)는 안전하게 `body-replace`로 Fallback 하도록 설계되어 데이터 파손 위험이 낮습니다.
*   백엔드(Java)와 프론트엔드(TS) 양측에서 Payload 검증 및 타입 안전성을 확보했습니다.

---

**결론:** 본 계획은 Smart-ERD의 마크다운 플러그인을 실무 수준의 협업 도구로 격상시키기에 충분하며, 즉시 실행에 옮겨도 무방한 수준의 높은 완성도를 갖추고 있습니다.

---

## Codex Review

**Status:** Timed out after 120s. Codex (GPT-5.4) spent all time reading codebase files (BaseCollaborationPlugin, MarkdownScopeResolver, DiagramMessageSender, etc.) without producing structured review output.

---

## Consensus Summary

With only one reviewer (Gemini) completing successfully, consensus is based on Gemini's analysis alone.

### Key Findings

1. **Overall Assessment: LOW RISK** — Plans are comprehensive with defensive design
2. **Strongest aspect:** Gap Closure plans (05, 06, 07) that address concurrent edit safety, memory leaks, and parser edge cases
3. **Main concerns (all MEDIUM/LOW):**
   - Large document parsing overhead on every `setEditorBuffer` call (MEDIUM)
   - Nested fenced code block edge cases in heading parser (LOW)
   - Remote change re-parsing frequency during heavy collaboration (LOW)

### Suggestions Worth Considering

- Cache `computeSectionBoundaries` results for very large documents
- Add fallback for Worker `marked.parse` failures (show error per section, keep previous cache)
- Track `activeSectionId` via Monaco `onDidChangeCursorPosition` for more accurate auto-accept UX
