# Smart ERD Project Workspace

Smart ERD의 프로젝트 작업공간은 문서 허브, 구조 계획, 일정 시각화, 개인 실행 작업을 한 제품 안에서 연결하는 컨텍스트다. 이 문서는 TODO, WBS, Gantt를 같은 뜻으로 섞지 않기 위해 핵심 용어를 고정한다.

## Language

**My Task**:
프로젝트 안에서 한 사용자가 직접 소유하고 관리하는 개인 실행 작업이다.
_Avoid_: Shared task, project issue, team board item

**WBS Item**:
프로젝트의 작업 구조, 범위, 책임을 표현하는 계층형 작업 패키지다.
_Avoid_: Personal todo, kanban card

**WBS Link**:
My Task를 특정 WBS Item 문맥에 연결하는 관계다.
_Avoid_: Ownership transfer, project-wide assignment

**Shared Todo Document**:
My Task에 연결된 문서 중 프로젝트 문맥에서 다른 사람에게 공개된 문서다.
_Avoid_: Private note, task attachment

**Gantt View**:
WBS와 마일스톤을 일정과 의존성 관점에서 시각화하는 상위 타임라인이다.
_Avoid_: Daily execution board, personal task list

**Kanban Board**:
실행 상태별로 **My Task**를 열 단위로 정리해 빠르게 훑고 이동시키는 운영형 보드 뷰다.
_Avoid_: WBS tree, gantt timeline

## Relationships

- A **My Task** belongs to exactly one user within one project.
- A **My Task** may link to zero or one **WBS Item** through a **WBS Link**.
- A **My Task** may expose zero or more **Shared Todo Documents** to the project.
- A **WBS Item** is shared project structure, not a personal execution card.
- A **Gantt View** visualizes **WBS Items** and milestones, not **My Tasks**.
- The v1 **Kanban Board** is a projection of **My Tasks**, not a separate shared work model.
- The v1 **Kanban Board** uses derived ordering inside each column instead of a persisted board-order model.

## Example dialogue

> **Dev:** "칸반 보드를 만들면 WBS를 그대로 카드로 옮기면 되나요?"
> **Domain expert:** "아니요. **WBS Item**은 구조와 책임의 기준이고, v1 **Kanban Board**는 **My Task**를 상태별로 보는 개인 실행 뷰여야 합니다."

## Flagged ambiguities

- "TODO"가 **My Task** 와 **WBS Item 하위 작업** 을 함께 뜻하는 것처럼 쓰일 수 있다. 현재 구현 기준의 기본 의미는 **My Task** 로 고정한다.
- "보드"는 **Kanban Board** 를 뜻하고, **WBS tree** 나 **Gantt View** 와 구분한다.
