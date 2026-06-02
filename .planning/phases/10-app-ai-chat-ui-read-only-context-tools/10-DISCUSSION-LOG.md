# Phase 10: App AI Chat UI + Read-Only Context Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 10-App AI Chat UI + Read-Only Context Tools
**Areas discussed:** 채팅 진입 위치, 프로젝트 컨텍스트 선택 방식, 읽기 도구 데이터 범위, 답변의 근거 표시 방식

---

## 채팅 진입 위치

| Option | Description | Selected |
|--------|-------------|----------|
| 프로젝트 화면 우측 drawer | Project-local right drawer; could feel attached to project workspace but would not automatically survive routes unless made global. | |
| 프로젝트 워크스페이스의 별도 AI 탭 | Treat AI as a full workspace tab; conversation screen disappears when leaving the tab. | |
| 우하단 플로팅 AI 버튼 | Global floating widget; route persistence is natural but it can overlap tables, panels, dialogs, and toasts. | |
| 전역 우측 AI drawer | Global right drawer opened from app UI; route movement keeps drawer and messages alive. | selected |

**User's choice:** 전역 우측 AI drawer.
**Notes:** The user explicitly wanted the chat window to stay open while moving between screens. The drawer must be global, not page-local.

| Option | Description | Selected |
|--------|-------------|----------|
| 프로젝트 관련 화면에만 노출 | Shows AI only where project/team context is already clear. | |
| 로그인 후 모든 화면에 노출 | Makes AI available from all authenticated screens. | selected |
| 프로젝트 상세 진입 후에만 노출 | Conservative placement; weak project-list entry point. | |

**User's choice:** 로그인 후 모든 화면.
**Notes:** AI should not be tied to a single project. Users may ask for a project by name or inspect all work by project.

| Option | Description | Selected |
|--------|-------------|----------|
| 라우트 이동 중만 유지 | Keeps messages while moving routes, resets on refresh. | |
| 브라우저 새로고침까지 유지 | Uses browser-local persistence, avoids Phase 11 server history scope. | selected |
| 서버에 대화 기록 저장 | Strong persistence but overlaps audit/history design. | |

**User's choice:** 브라우저 새로고침까지 유지.
**Notes:** Phase 10 should use browser-local persistence only.

| Option | Description | Selected |
|--------|-------------|----------|
| 사용자가 새 대화 버튼을 누를 때만 초기화 | Keeps conversation through route, refresh, and context changes. | selected |
| 브라우저 탭을 닫으면 초기화 | Session-like persistence. | |
| 팀/프로젝트 context가 바뀌면 새 대화로 분리 | Project-bound behavior; conflicts with cross-project questions. | |

**User's choice:** 사용자가 새 대화 버튼을 누를 때만 초기화.
**Notes:** Context changes alone must not reset the conversation.

---

## 프로젝트 컨텍스트 선택 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 명시 선택 우선 | User manually chooses team/project/global scope before asking. | |
| 현재 화면 context 자동 상속 + 변경 가능 | Route context becomes the default and can be changed in the drawer. | selected |
| 질문 내용에서 프로젝트명을 자동 해석 | Natural but risky when names are ambiguous. | |

**User's choice:** 현재 화면 context 자동 상속 + 변경 가능.
**Notes:** Weak-context screens must require explicit scope before project-data answers.

| Option | Description | Selected |
|--------|-------------|----------|
| 현재 팀의 모든 프로젝트까지 허용 | Supports team-level PM questions and per-project comparisons. | selected |
| 사용자가 선택한 프로젝트들만 허용 | Safer but adds repeated selection friction. | |
| 전체 팀/전체 프로젝트를 모두 허용 | Powerful but too broad for Phase 10 MVP. | |

**User's choice:** 현재 팀의 모든 프로젝트까지 허용.
**Notes:** Multi-project questions may expand within the current team only.

| Option | Description | Selected |
|--------|-------------|----------|
| 확인 질문을 먼저 한다 | Show candidates and require the user to choose. | selected |
| 가장 그럴듯한 프로젝트로 답하고 경고를 붙인다 | Faster but risks wrong project answers. | |
| 현재 화면 context를 우선하고 질문 속 프로젝트명은 무시한다 | Simple but can ignore user intent. | |

**User's choice:** 확인 질문을 먼저 한다.
**Notes:** Ambiguous or conflicting project names should not produce guessed answers.

| Option | Description | Selected |
|--------|-------------|----------|
| drawer 상단 context bar | Shows current scope before asking. | |
| 각 답변 아래 source chip만 표시 | Shows actual sources after answering. | |
| 상단 context bar + 답변별 source chip | Shows both current scope and actual sources used. | selected |

**User's choice:** 상단 context bar + 답변별 source chip.
**Notes:** The user preferred maximum clarity even with some UI complexity.

---

## 읽기 도구 데이터 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 질문에 맞는 도구만 선택 조회 | Calls only the relevant read tools per question. | selected |
| 항상 프로젝트 전체 요약 번들 조회 | Rich but slow and token-heavy. | |
| 처음엔 전체 요약, 이후 질문별 추가 조회 | Good conversationally but more complex state tracking. | |

**User's choice:** 질문에 맞는 도구만 선택 조회.
**Notes:** Do not inject the full project bundle on every question.

| Option | Description | Selected |
|--------|-------------|----------|
| 요약 우선 + 필요 시 상세 재조회 | Default to counts/distributions/risk/recent items, fetch detail on demand. | selected |
| 항상 상세 목록 전체 반환 | Simple but slow and noisy. | |
| 상위 N개만 고정 반환 | Fast but can miss important items. | |

**User's choice:** 요약 우선 + 필요 시 상세 재조회.
**Notes:** Detail requests should trigger follow-up read tool calls.

| Option | Description | Selected |
|--------|-------------|----------|
| 내 TODO만 읽기 | Strong privacy and matches current API. | selected as default |
| 프로젝트 멤버 전체 TODO 요약 읽기 | Useful for PM questions if authorized. | selected conditionally |
| 공개/공유된 TODO만 팀 단위로 읽기 | Balanced but needs more visibility logic. | |

**User's choice:** Default to my TODOs, but allow member-wide TODO summaries when the question explicitly asks and authorization permits it.
**Notes:** Member-wide reads must stay summary-oriented by default.

| Option | Description | Selected |
|--------|-------------|----------|
| 최근 히스토리 중심 | Reads recent activities/comments and change summaries. | selected |
| 선택한 WBS 항목 중심 | Accurate for selected-item questions but weaker for overall flow. | |
| 최근 히스토리 + 선택 WBS 우선 | Richer but more complex. | |

**User's choice:** 최근 히스토리 중심.
**Notes:** The default work-history context is recent activity/comment summaries.

---

## 답변의 근거 표시 방식

| Option | Description | Selected |
|--------|-------------|----------|
| 답변 본문 안에서 구분 | Text sections such as confirmed/inferred. | |
| 답변 카드 구조로 구분 | Card sections for facts, interpretation/proposal, and needs confirmation. | selected |
| source chip만 보여주고 본문은 자연어로 유지 | Easy to read but weak fact/inference boundary. | |

**User's choice:** 답변 카드 구조로 구분.
**Notes:** The card should separate confirmed facts, interpretation/proposal, and needs confirmation.

| Option | Description | Selected |
|--------|-------------|----------|
| 사용한 도구 이름만 표시 | Simple labels such as issues/WBS/milestones. | |
| 프로젝트 + 도구 + 개수 표시 | Shows source scope and volume. | selected |
| 프로젝트 + 도구 + 주요 항목 링크까지 표시 | Strong but adds routing/link design. | |

**User's choice:** 프로젝트 + 도구 + 개수 표시.
**Notes:** Example chips: `A Project - issues 12`, `B Project - WBS 34`, `Current team - projects 4`.

| Option | Description | Selected |
|--------|-------------|----------|
| 업무 보고형 | Summary first, risks/delays/next checks. | selected |
| 대화형 도우미 | Friendly but less decision-oriented. | |
| 상세 분석형 | Thorough but heavy for every answer. | |

**User's choice:** 업무 보고형.
**Notes:** Tone should fit SI PM work reporting.

| Option | Description | Selected |
|--------|-------------|----------|
| 확인 질문 먼저 | Ask before answering when scope/period/target is unclear. | selected |
| 가능한 범위만 답하고 부족한 점을 표시 | Faster but can be misunderstood. | |
| 현재 context 기준으로 추정 답변 | Fast but risks wrong work decisions. | |

**User's choice:** 확인 질문 먼저.
**Notes:** Avoid guessed answers when the data or scope is insufficient.

## the agent's Discretion

- Exact component names, state shape, and persistence mechanics.
- Exact backend endpoint shape for read tools, as long as authorization, summary-first depth, and question-selected execution are preserved.

## Deferred Ideas

- Server-stored AI chat history and audit/history lookup belong to Phase 11.
- Action proposals, approval previews, and write execution belong to Phase 11/12.
- Cross-team/all-team AI querying is excluded from Phase 10 MVP.
