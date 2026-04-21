# Phase 6: 간트 차트 - Research

**Researched:** 2026-04-16
**Domain:** `@svar-ui/react-gantt` integration over existing WBS/Milestone APIs
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md / plan review)

### Locked Decisions

- **D-01:** 간트는 별도 `gantt` 탭으로 추가한다. 기존 `wbs` 탭 CRUD는 유지한다.
- **D-02:** 직접 Canvas/SVG 엔진 구현은 금지하고 `@svar-ui/react-gantt`를 사용한다.
- **D-03:** 신규 백엔드 엔드포인트나 DB 마이그레이션은 추가하지 않는다. 기존 WBS/Milestone API만 사용한다.
- **D-04:** 날짜는 `DATE` 개념으로 다뤄야 하며 타임존 오차를 피해야 한다.
- **D-05:** 줌 UI는 앱 커스텀 버튼(`[일|주|월|오늘]`)으로 제어한다. 기본 Toolbar는 쓰지 않는다.
- **D-06:** Phase 6 범위는 시각화 + 기간 조정이다. WBS 구조 편집, dependency 관리, 내장 editor는 범위 밖이다.
- **D-07:** milestone은 다이아몬드로 보여야 하고 지연 여부가 구분돼야 한다.

### Claude's Discretion

- `GanttTab` 레이아웃 상세
- adapter 함수 구조
- tooltip / legend의 구체 구성
- summary task 계산 방식
- 어떤 액션을 intercept로 막고 어떤 UI를 columns/CSS로 막을지의 분기

### Deferred Ideas (OUT OF SCOPE)

- dependency authoring
- built-in Editor side panel
- add/delete task from gantt UI
- progress drag/edit
- gantt에서 WBS hierarchy 재구성
- server-driven gantt projection API

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GANTT-01 | WBS 데이터를 기반으로 간트 차트가 자동 렌더링된다 | WBS `startDate/endDate` -> standard task, undated parent with dated descendants -> summary, milestone API -> built-in milestone |
| GANTT-02 | 일/주/월 단위로 타임라인을 조절할 수 있다 | `scales` prop과 앱 커스텀 preset state로 구현 가능 |
| GANTT-03 | 간트 바를 드래그하여 기간을 변경할 수 있다 | `update-task` 액션에서 날짜 변경을 잡아 기존 `updateWbsItem()`으로 저장 가능 |
| GANTT-04 | 마일스톤이 다이아몬드 마커로 표시된다 | built-in `type: "milestone"`이 zero-duration diamond를 제공 |

</phase_requirements>

---

## Summary

Phase 6의 핵심은 새로운 gantt 도메인을 만드는 것이 아니라, **Phase 5에서 이미 존재하는 WBS/Milestone 데이터를 `@svar-ui/react-gantt`가 기대하는 task 모델로 안정적으로 적응시키는 것**이다. 이 Phase는 프론트엔드 통합 작업이며, 백엔드 확장은 필요하지 않다.

직접 확인한 코드 기준으로 현재 통합 지점은 이미 충분히 준비되어 있다:

- 프로젝트 허브 탭 셸은 [DiagramsPage.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/pages/diagram/DiagramsPage.tsx)에서 로컬 state 기반으로 확장 가능하다.
- WBS는 [wbsApi.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/api/wbsApi.ts)와 [WbsTab.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/WbsTab.tsx) 경로로 CRUD/재정렬이 이미 존재한다.
- 마일스톤은 [milestoneApi.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/api/milestoneApi.ts)와 [MilestonePanel.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/milestone/MilestonePanel.tsx) 경로로 읽기/수정 흐름이 존재한다.
- 쿼리 무효화는 [useProjectQueryInvalidation.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/hooks/useProjectQueryInvalidation.ts)에서 WBS/마일스톤/사업 개요를 묶어 이미 제공한다.

외부 라이브러리 쪽에서 이번 Phase에 중요한 사실은 네 가지다.

1. **스타일/테마는 필수 세트가 있다.**
   - 공식 문서는 `@svar-ui/react-gantt/all.css` import를 가장 안전한 선택이라고 안내한다.
   - 테마 wrapper (`Willow`, dark 계열은 `WillowDark`)가 없으면 시각 스타일이 완전하지 않다.
   - flexible layout에서는 `.wx-theme { height: 100% }`와 부모 높이 계약이 동시에 필요하다.

2. **task 타입은 기본 3종으로 충분하다.**
   - `task`: 시작/종료/진척률을 가진 일반 작업
   - `summary`: 자식 기반으로 집계되는 상위 작업
   - `milestone`: `start`만 갖는 zero-duration diamond
   - 즉, Phase 6은 custom task type 없이도 요구사항을 충족할 수 있다.

3. **기간 편집은 `update-task`, 구조 이동은 `move-task`/`drag-task`로 분리해 다뤄야 한다.**
   - `update-task`는 `inProgress`와 함께 들어오며, 날짜가 바뀌면 `start/end/duration`을 함께 제공해야 한다.
   - `move-task`는 `before/after/up/down/child` 같은 트리 재배치 이벤트다.
   - `drag-task`는 chart/grid 드래그 차단용 세부 인터셉트 포인트다.

4. **기본 UI는 너무 많은 편집 기능을 열어둔다.**
   - 기본 columns에는 add-task 버튼 열이 포함된다.
   - 기본 액션은 add/delete/link/indent/move/edit까지 열려 있다.
   - 따라서 Phase 6에서는 columns 필터링 + `api.intercept()` 조합으로 범위를 강하게 제한해야 한다.

**Primary recommendation:** executor는 `GanttTab + adapter + date-only utils` 3축으로 시작해야 한다. 즉, 먼저 날짜/정렬/타입 적응 계층을 확정하고, 그다음 탭 UI와 이벤트 저장을 연결하는 순서가 가장 안전하다.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@svar-ui/react-gantt` | latest repo-selected | 간트 시각화/편집 surface | Phase 6 locked decision. built-in `task/summary/milestone`, API intercept, grid/chart 제공 |
| React Query | existing | WBS/Milestone fetch + refetch | 이미 repo 전체에서 사용 중 |
| Zustand theme store | existing | Willow/WillowDark 선택 기준 | 이미 [useThemeStore.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/stores/useThemeStore.ts) 존재 |
| Tailwind + CSS variables | existing | gantt wrapper/theming bridge | 기존 앱 theme token 체계와 일치 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Intl.DateTimeFormat` | built-in | locale 날짜 표기 | legend/tooltip/보조 표시 |
| Node test infra | existing | adapter/date utils regression tests | `client/test/unit` 패턴 재사용 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in milestone | custom task type | diamond/기본 동작을 다시 만들어야 해서 불필요 |
| Existing WBS update API reuse | gantt 전용 update API | Phase 6 범위를 넘어감 |
| `new Date('yyyy-MM-dd')` direct parse | date-only helper | direct parse는 timezone/day-boundary 버그 위험 |
| Default toolbar | app toolbar | 기본 toolbar는 Phase 6 범위를 넘는 액션을 너무 많이 연다 |

---

## External Facts (Official Docs)

아래는 이번 Phase에서 실제로 의미 있는 공식 문서 사실이다.

1. **Quickstart / styling**
   - `all.css`가 안전한 기본 import다.
   - `style.css`는 Grid/Editor 등 내부 의존 스타일이 빠질 수 있다.
   - `Willow` theme wrapper가 필요하다.
   - flexible layout에서는 `.wx-theme { height: 100% }`와 부모 높이 체인이 필요하다.
   - Source: https://docs.svar.dev/react/gantt/guides/styling

2. **Task model**
   - `tasks`의 `id`는 `string | number`
   - `text`, `start`, `end`, `duration`, `progress`, `type`, `parent`를 사용할 수 있다.
   - built-in `type`은 `task | summary | milestone`
   - Source: https://docs.svar.dev/react/gantt/api/properties/tasks

3. **Task types**
   - standard task는 drag/resize/progress editing 지원
   - milestone은 `start`만 갖고 duration/progress가 없다
   - summary는 자식으로부터 날짜를 계산한다
   - summary drag는 `drag-task` intercept로 막을 수 있다
   - Source: https://docs.svar.dev/react/gantt/guides/configuration/task_types/

4. **Update action**
   - `update-task` payload에는 `id`, `task`, `diff?`, `inProgress?`, `eventSource?`
   - 날짜 필드가 바뀌면 `start`, `end`, `duration`을 함께 넘겨야 한다
   - `false` 반환으로 액션을 막을 수 있다
   - Source: https://docs.svar.dev/react/gantt/api/actions/update-task

5. **Move / prevent actions**
   - `move-task`는 `before | after | up | down | child` 모드를 갖는다
   - `drag-task`는 `left/width/top` 축 정보를 바탕으로 chart drag / grid reorder를 가를 수 있다
   - 기본 add-task 버튼 열은 `defaultColumns.filter(c => c.id !== "add-task")`로 제거 가능하다
   - Source:
     - https://docs.svar.dev/react/gantt/api/actions/move-task/
     - https://docs.svar.dev/react/gantt/api/actions/drag-task/
     - https://docs.svar.dev/react/gantt/guides/configuration/prevent_actions/

6. **Scales**
   - `scales` prop에 원하는 수의 scale rows를 줄 수 있다
   - day/week/month preset을 앱 상태로 충분히 표현 가능하다
   - Source: https://docs.svar.dev/react/gantt/guides/configuration/configure_scales/

---

## Architecture Patterns

### Current Codebase Facts (direct inspection)

**Project hub structure**
- [DiagramsPage.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/pages/diagram/DiagramsPage.tsx)는 `documents | overview | wbs` 탭을 이미 local state로 제어한다.
- 즉, `gantt` 탭 추가는 구조적으로 자연스럽다.

**WBS ordering and tree utilities**
- [wbs-tree-utils.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/wbs/wbs-tree-utils.ts)는 `buildChildrenByParent()`, `flattenTreeItems()`로 `sortOrder` 기반 트리 순서를 이미 확정한다.
- gantt adapter는 raw API 순서를 다시 믿지 말고 이 유틸을 재사용하는 편이 안전하다.

**WBS data model**
- [types/wbs.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/wbs.ts)의 핵심 필드는 `name`, `parentId`, `startDate`, `endDate`, `progressRate`, `milestoneId`, `sortOrder`, `depth`
- gantt용 추가 projection API 없이도 충분하다.

**Milestone data model**
- [types/milestone.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/milestone.ts)는 `name`, `targetDate`, `linkedWbsItemCount`, `achievementRate`, `isDelayed`
- milestone diamond + legend/tooltip에 바로 쓸 수 있다.

**Query invalidation**
- [useProjectQueryInvalidation.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/hooks/useProjectQueryInvalidation.ts)는 이미 WBS/마일스톤/사업 개요 invalidation을 한 번에 처리한다.
- gantt 저장 성공 후 이 훅만 호출하면 Phase 5 화면과 자연스럽게 동기화된다.

**Date formatting risk already exists**
- [format.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/lib/format.ts)는 `formatProjectDate()`에서 `timeZone: 'UTC'`를 주고도 `new Date(date)`를 쓴다.
- 표시용은 운 좋게 버티더라도, gantt 편집 로직에는 같은 패턴을 재사용하면 안 된다.

### Pattern 1: Date-only adapter layer

**What:** `yyyy-MM-dd` <-> local `Date` 변환을 전담하는 helper
**When to use:** WBS/milestone API와 gantt task model 사이에서 항상 사용

```ts
export function parseDateOnly(value: string): Date;
export function formatDateOnly(date: Date): string;
export function inclusiveDurationDays(start: Date, end: Date): number;
```

**Why:** gantt는 `Date` 객체를 기대하고, Phase 5 API는 `yyyy-MM-dd` 문자열을 준다. 이 변환이 흩어지면 day-boundary 버그가 생긴다.

### Pattern 2: Flat tasks with `parent`, not nested `data`

**What:** gantt `tasks`는 flat array + `parent` 관계로 공급
**When to use:** WBS tree order와 서버 parentId 모델을 그대로 유지하고 싶을 때

```ts
{
  id: wbs.id,
  text: wbs.name,
  parent: wbs.parentId ?? undefined,
  start,
  end,
  duration,
  progress: wbs.progressRate,
  type: "task"
}
```

**Why:** 현재 WBS는 이미 adjacency list + depth/sortOrder 모델이다. nested `data`를 별도로 만들 이유가 없다.

### Pattern 3: Summary task as projection, not persisted entity

**What:** 날짜가 없는 부모라도 하위 dated descendants가 있으면 gantt에서는 `summary`
**When to use:** WBS 상위 항목 자체는 일정 미입력 상태지만 gantt 트리에는 보여야 할 때

```ts
if (!item.startDate && !item.endDate && hasDatedDescendants(item.id)) {
  return {
    id: item.id,
    text: item.name,
    type: "summary",
    start: minChildStart,
    end: maxChildEnd,
    open: true,
  };
}
```

**Why:** 공식 문서상 summary는 자식 일정으로 계산되는 타입이다. Phase 5 서버 모델을 바꾸지 않고도 gantt에 필요한 상위 bar를 만들 수 있다.

### Pattern 4: Intercept-first action gating

**What:** 범위 밖 액션은 UI hiding만 믿지 말고 `api.intercept()`에서 차단
**When to use:** add-task, move-task, drag-task, add-link, delete-link, indent-task, update-task editor-open 등

```ts
api.intercept("move-task", () => false);
api.intercept("add-task", () => false);
api.intercept("add-link", () => false);
api.intercept("delete-link", () => false);
api.intercept("indent-task", () => false);
api.intercept("drag-task", ev => {
  if (typeof ev.top !== "undefined") return false; // grid reorder
  if (taskIsSummaryOrMilestone(ev.id)) return false;
});
```

**Why:** 기본 UI는 생각보다 많은 편집 경로를 노출한다. columns 제거만으로는 충분하지 않다.

### Pattern 5: Persist only finalized WBS date edits

**What:** `update-task`에서 `inProgress !== true`인 최종 상태만 서버에 저장
**When to use:** 바 drag/resize 후 mouse up 시점 저장

```ts
api.on("update-task", ({ id, task, inProgress }) => {
  if (inProgress) return;
  if (!isWbsTask(id)) return false;
  if (!task.start || !task.end || typeof task.duration === "undefined") return false;
  mutateUpdateWbs(...);
});
```

**Why:** drag 중에 mutation을 때리면 네트워크/토스트/refetch가 과도하게 발생하고 UX가 깨진다.

---

## Risks and Pitfalls

### Pitfall 1: Height chain only partially fixed

**Symptom:** gantt가 안 보이거나 몇 px 높이로 collapse

**Why it happens:** `.wx-theme { height: 100% }`만 추가하고 실제 wrapper에 explicit height/min-height를 주지 않음

**Mitigation:**
- `GanttTab` shell에 `min-h-[32rem]` 이상 부여
- desktop에서는 `min-h-[40rem]`
- 필요 시 `h-[calc(100vh-...)]`를 추가하되 min-height 계약은 유지

### Pitfall 2: `text` 누락으로 task title이 비어 보임

**Symptom:** grid/chart row는 있는데 제목이 공백

**Why it happens:** repo 모델은 `name`, SVAR는 `text`를 기본 표시 필드로 사용

**Mitigation:** 모든 WBS/milestone projection에서 `text <- name`

### Pitfall 3: Raw API 순서에 의존해 tree order가 뒤틀림

**Symptom:** WBS 탭과 gantt 탭 순서가 다르거나 부모/자식 묶음이 어색함

**Why it happens:** 서버가 우연히 정렬해 준 순서를 그대로 믿음

**Mitigation:** `buildChildrenByParent()` + `flattenTreeItems()`로 순서를 확정한 뒤 projection

### Pitfall 4: Summary/milestone을 저장 단계에서만 막음

**Symptom:** 사용자가 summary/milestone을 드래그할 수는 있는데 저장 시 튕기고 다시 돌아감

**Why it happens:** mutation 전에 UI 차단이 없음

**Mitigation:** `drag-task`/`move-task` 단계에서 먼저 false 반환

### Pitfall 5: `update-task`에서 날짜 필드를 일부만 보냄

**Symptom:** gantt 내부 state와 앱 state가 어긋나거나 저장 후 다른 날짜로 튐

**Why it happens:** 공식 문서가 요구하는 `start/end/duration` 동시 제공 규칙을 어김

**Mitigation:** 최종 상태 저장 전 세 필드 존재 여부를 검증

### Pitfall 6: 기본 add-task 열과 link handle을 방치

**Symptom:** 사용자가 Phase 6 범위 밖의 add/link UI를 클릭 가능

**Mitigation:**
- `defaultColumns.filter(c => c.id !== "add-task")`
- link handle은 CSS로 숨기고 `add-link/delete-link` 인터셉트도 같이 둠

---

## Recommended Implementation Order

1. **`gantt-date-utils.ts` 작성**
   - parse/format/duration/range helper

2. **`gantt-adapter.ts` 작성**
   - WBS 정렬 -> task projection
   - milestone projection
   - summary projection
   - initial range 계산

3. **`GanttTab.tsx` shell 작성**
   - all.css import
   - Willow/WillowDark wrapper
   - explicit min-height shell
   - React Query 연결

4. **Action gating 적용**
   - columns에서 add-task 제거
   - `move-task`, `drag-task`, `add-task`, `add-link`, `delete-link`, `indent-task` 차단

5. **Persist finalized WBS date edits**
   - `update-task` final state -> `updateWbsItem()`
   - 성공 시 `useProjectQueryInvalidation()`

6. **Legend/empty/error/zoom preset/i18n 보강**

---

## Executor Handoff

### Do First

1. `client/package.json`에 `@svar-ui/react-gantt` 추가
2. `client/src/components/gantt/gantt-date-utils.ts` 작성
3. `client/src/components/gantt/gantt-adapter.ts`에서 `text <- name`, `sortOrder` 기반 tree order, summary/milestone projection 고정
4. `client/src/components/gantt/GanttTab.tsx`에 `all.css` + `Willow/WillowDark` + explicit min-height shell 적용

### Avoid

- `new Date('yyyy-MM-dd')` 직접 사용
- raw API 순서를 그대로 신뢰
- default toolbar를 그대로 노출
- summary/milestone을 draggable 상태로 두고 저장에서만 막기
- gantt용 전용 backend projection API를 새로 설계하기

### Executor-ready verdict

현재 plan + research 기준으로 Phase 6은 **executor handoff ready** 상태다. 남은 불확실성은 라이브러리 계약이 아니라 구현 디테일 수준이며, 공식 문서와 현재 repo 패턴으로 충분히 제어 가능하다.

---

_Research synthesized locally after `gsd-phase-researcher` kickoff and timeout fallback._
