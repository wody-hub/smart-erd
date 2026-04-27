# 가이드 페이지 UX 구조 설계

> 작성일: 2026-04-24
> 상태: RIS-205 산출물 초안
> 기준 코드/문서:
> - [client/src/constants/routes.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/constants/routes.ts)
> - [client/src/components/layout/Header.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/Header.tsx)
> - [client/src/pages/team/TeamsPage.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/pages/team/TeamsPage.tsx)
> - [client/src/pages/project/ProjectsPage.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/pages/project/ProjectsPage.tsx)
> - [client/src/pages/diagram/DiagramsPage.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/pages/diagram/DiagramsPage.tsx)
> - [client/src/components/workspace/DocumentHubTabContent.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/workspace/DocumentHubTabContent.tsx)
> - [client/src/types/workspace.ts](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/types/workspace.ts)
> - [docs/ddl-to-erd-dsl-guide.md](/Users/j.jaeyo/Project/ETC/smart-erd/docs/ddl-to-erd-dsl-guide.md)
> - [plan/2026-03-31-문서-플랫폼-진입-UX-UI-개선/00-개요.md](/Users/j.jaeyo/Project/ETC/smart-erd/plan/2026-03-31-문서-플랫폼-진입-UX-UI-개선/00-개요.md)

## 1. 설계 결론

- 가이드 페이지는 새 `DocumentPluginId`가 아니라, 문서 플랫폼 위에 놓이는 별도 워크스페이스 유틸리티 페이지로 두는 편이 맞다.
- 1차 구현은 인증 이후 진입하는 보호 라우트 `'/guide'`를 기준으로 하고, 팀/프로젝트 맥락은 query 또는 route state로 넘겨 앵커 이동만 돕는다.
- 정보구조는 기능 목록형이 아니라 사용자 여정형으로 묶는다. 사용자는 "어디서 무엇을 눌러야 하는가"를 찾으러 들어오지 "ERD/Markdown/Screen Spec 내부 구조"를 배우러 들어오지 않는다.
- 진입은 한 군데가 아니라 3단으로 설계한다. `헤더의 상시 진입`, `empty state의 고강도 진입`, `기능 내부의 맥락형 deep link`가 같이 있어야 한다.
- 기존 DSL 문법/오류 가이드와 별도 문서([docs/ddl-to-erd-dsl-guide.md](/Users/j.jaeyo/Project/ETC/smart-erd/docs/ddl-to-erd-dsl-guide.md))는 유지하고, 가이드 페이지는 상위 맵과 여정 연결을 담당한다.

## 2. 현재 기준선

- 현재 라우트는 `teams -> projects -> documents(diagrams) -> document editor` 흐름과 `dictionary`, `wbs`, `settings` 중심이다. 별도 도움말/온보딩 라우트는 없다.
- 상단 헤더는 이미 워크스페이스 breadcrumb를 갖고 있어서, 전역 가이드 진입 CTA를 가장 자연스럽게 추가할 수 있다.
- 프로젝트 허브는 `documents`, `overview`, `wbs`, `gantt`, `staffing`, `issues`까지 확장된 상태라서, 가이드가 문서 타입이 아니라 허브 바깥의 보조 탐색이어야 한다.
- 문서 허브는 `erd`, `markdown`, `screen-spec` 세 타입만 전제로 렌더링한다. 여기에 "guide"를 추가하면 사용자 산출물과 제품 사용 설명이 섞인다.
- 현재 사용자 도움말은 ERD 내부의 문법/오류 가이드에 국한되어 있어, 팀 생성 이후 전체 사용자 여정을 연결하는 상위 설명이 비어 있다.

## 3. 가이드 페이지의 역할 정의

### 페이지 역할

- 제품 개요 페이지가 아니라 "실제 작업 시작용 안내 허브"로 둔다.
- 기능 사전식 설명보다 "다음 행동"을 빠르게 고를 수 있게 한다.
- 현재 화면 맥락에서 들어오면 그 맥락에 맞는 섹션으로 바로 점프시킨다.

### 페이지 성격

- 전역 Utility Page
- 읽고 끝나는 문서가 아니라, 각 화면으로 다시 보내는 내비게이션 허브
- 최초 진입 사용자를 위한 온보딩과 숙련 사용자를 위한 문제 해결 링크를 동시에 제공

### 라우트 원칙

- 1차: `ROUTES.GUIDE = '/guide'`
- 1차: `WorkspaceSection`에 `'guide'` 추가
- 1차: `Header` 우측 유틸에 가이드 버튼 추가
- 1차: `'/teams/:teamId/...` 아래 새 문서 타입으로 넣지 않음
- 2차 확장 여지: 공개 도움말이 필요해지면 비인증 전용 `'/help'`를 별도 shell로 분리

## 4. 제안 정보구조

### 페이지 맵

```text
Guide Page
  ├─ Hero / 빠른 시작 분기
  ├─ Smart-ERD 작업 흐름 한눈에 보기
  ├─ 처음 시작하기
  │   ├─ 팀 만들기
  │   ├─ 프로젝트 열기
  │   └─ 첫 문서 선택
  ├─ 작업별 가이드
  │   ├─ ERD 시작하기
  │   ├─ Markdown 문서 쓰기
  │   ├─ 화면기획(Screen Spec) 쓰기
  │   ├─ 데이터 사전 연결하기
  │   └─ 프로젝트 운영 탭 활용하기
  ├─ 자주 막히는 지점
  │   ├─ DSL 문법/오류
  │   ├─ 문서 타입 선택
  │   ├─ 사전 컨텍스트 선택
  │   └─ 협업/운영 화면 구분
  └─ 다음 행동 CTA
```

### 섹션별 목적

| 섹션 | 목적 | 핵심 질문 | 종료 CTA |
|---|---|---|---|
| Hero | 지금 무엇을 할지 고르게 한다 | "어디서 시작하지?" | `팀 만들기`, `프로젝트 열기`, `문서 허브 보기` |
| 작업 흐름 맵 | 팀-프로젝트-문서-사전의 구조를 이해시킨다 | "화면 간 관계가 뭐지?" | `내 위치에서 계속하기` |
| 처음 시작하기 | 첫 사용자의 초기 성공 경험을 만든다 | "첫 10분 안에 뭘 해야 하지?" | `첫 프로젝트 만들기` |
| 작업별 가이드 | 기능별 진입 판단 비용을 줄인다 | "ERD/Markdown/화면기획 중 뭘 써야 하지?" | 각 기능 화면으로 이동 |
| 자주 막히는 지점 | 오류/혼란을 줄인다 | "왜 안 되지?" | DSL 가이드, 사전, 문서 허브로 deep link |
| 다음 행동 CTA | 읽고 끝나지 않게 한다 | "이제 어디로 가지?" | 최근 맥락 복귀 |

## 5. 섹션 와이어 구조

### 5.1 Hero

```text
[Eyebrow] Smart-ERD Guide
[H1] 팀에서 프로젝트를 만들고, 문서를 열고, 사전과 연결해 바로 작업을 시작합니다.
[Body] 처음 쓰는 사용자도 3단계로 시작하고, 이미 작업 중인 사용자는 현재 화면에 맞는 가이드를 바로 찾을 수 있습니다.

[Primary CTA] 빠르게 시작하기
[Secondary CTA] 내 위치 기준 가이드 보기

[Quick Choice Cards]
- 팀부터 시작
- ERD를 먼저 만들기
- 문서/화면기획부터 시작
```

- 카피 방향: 개념 설명보다 "시작-이동-작업" 동사를 쓴다.
- 시각 요소: 제품 전체 구조를 요약한 3단계 flow strip 또는 간단한 workspace map.
- 컴포넌트 패턴: `ProjectWorkspaceHero` 계열 확장 또는 동일 톤의 guide hero.

### 5.2 Smart-ERD 작업 흐름 맵

```text
팀 선택/생성
  -> 프로젝트 진입
     -> 문서 허브에서 작업 종류 선택
        -> ERD / Markdown / Screen Spec 작업
     -> 필요 시 Dictionary 연결
     -> 운영 탭(WBS/Gantt/Staffing/Issues) 활용
```

- 이 구간은 제품 구조를 설명하는 유일한 지도다.
- 각 노드는 설명 1줄과 "해당 화면 열기" 링크를 가진다.
- 프로젝트 허브와 문서 허브가 다른 역할이라는 점을 분명히 적는다.

### 5.3 처음 시작하기

```text
Step 1. 팀 만들기 또는 팀 선택
Step 2. 프로젝트 만들기
Step 3. 첫 문서 타입 선택
Step 4. 필요하면 Dictionary 연결
Step 5. 작업 후 운영 탭으로 정리
```

- 첫 사용자는 긴 설명보다 체크리스트형 흐름이 잘 맞는다.
- 각 step은 현재 라우트 기준 실제 버튼 명칭으로 적는다.
- 완료형 문장보다 행동형 문장을 쓴다.

### 5.4 작업별 가이드 카드

| 카드 | 보여줄 내용 | 주요 CTA |
|---|---|---|
| ERD 시작하기 | ERD가 적합한 상황, 사전 컨텍스트 필요 여부, DSL 가이드 링크 | `새 ERD 만들기`, `DSL 가이드 보기` |
| Markdown 문서 쓰기 | 회의록/스펙/메모에 적합하다는 점, 템플릿 선택 위치 | `새 Markdown 문서 만들기` |
| 화면기획 시작하기 | Screen Spec이 언제 필요한지, 화면 흐름/컴포넌트 산출물 관점 | `새 화면기획 문서 만들기` |
| 데이터 사전 연결하기 | ERD와 Dictionary의 관계, 팀 자산 성격, 언제 먼저 열어야 하는지 | `Dictionary 열기` |
| 프로젝트 운영 탭 활용하기 | WBS/Gantt/Staffing/Issues는 산출물 편집이 아니라 운영 관리라는 점 | `프로젝트 허브로 이동` |

### 5.5 자주 막히는 지점

이 구간은 FAQ보다 "복구용 네비게이션"에 가깝게 설계한다.

- DSL 문법이 헷갈릴 때
- 오류 가이드에서 용어/도메인 등록이 필요할 때
- 문서 타입을 잘못 골랐을 때
- 사전 컨텍스트가 왜 필요한지 이해되지 않을 때
- WBS/문서 허브/사전이 각각 어디에 있는지 헷갈릴 때

각 항목은 아래 3요소를 고정한다.

- 왜 막히는지 한 줄 설명
- 어디로 가야 해결되는지
- 바로 이동하는 deep link

### 5.6 다음 행동 CTA

- 최근 맥락이 있으면 `프로젝트로 돌아가기`, `문서 허브로 돌아가기`, `Dictionary 열기`를 우선 노출한다.
- 맥락이 없으면 `팀 목록으로 이동`, `첫 프로젝트 만들기`, `문서 타입 비교`를 노출한다.
- 읽기 종료 CTA가 아니라 작업 복귀 CTA여야 한다.

## 6. 사용자 여정별 안내 포인트

| 사용자 여정 | 주 진입 화면 | 가이드에서 먼저 보여줄 섹션 | 복귀 CTA |
|---|---|---|---|
| 첫 로그인 후 아무 팀도 없음 | `TeamsPage` empty state | `처음 시작하기` | `팀 만들기` |
| 팀은 있지만 프로젝트가 없음 | `ProjectsPage` empty state | `작업 흐름 맵` + `처음 시작하기` | `새 프로젝트 만들기` |
| 프로젝트는 있지만 문서가 없음 | `DiagramsPage` documents empty state | `작업별 가이드 카드` | `새 문서 만들기` |
| ERD 생성 직전 | 문서 생성 다이얼로그 | `ERD 시작하기` | `새 ERD 만들기` |
| DSL 오류/문법 혼란 | ERD editor 내 가이드 버튼 | `자주 막히는 지점 > DSL` | `에디터로 돌아가기` |
| Dictionary 의미 혼란 | `ProjectsPage`, `DiagramsPage`, `DictionaryPage` | `데이터 사전 연결하기` | `Dictionary 열기` |
| 운영 기능 탐색 | `DiagramsPage` non-doc tabs | `프로젝트 운영 탭 활용하기` | `프로젝트 허브로 돌아가기` |

## 7. 진입 위치와 반복 노출 규칙

### 7.1 전역 진입

- 위치: [Header.tsx](/Users/j.jaeyo/Project/ETC/smart-erd/client/src/components/layout/Header.tsx) 우측 유틸 그룹
- 형태: 텍스트 버튼 `가이드`
- 목적: 어디서든 낮은 비용으로 재진입 가능
- 반복 정책: 항상 노출

### 7.2 맥락형 진입

- 위치: `TeamsPage`, `ProjectsPage`, `DiagramsPage`, `DictionaryPage`의 hero 하단 또는 empty state 보조 CTA
- 형태: 보조 버튼 또는 inline link
- 목적: "막히기 쉬운 순간"에 강한 안내 제공
- 반복 정책: 해당 맥락에서만 노출

### 7.3 기능 내부 deep link

- 위치: DSL 문법 가이드, 오류 가이드, 문서 생성 다이얼로그
- 형태: `더 큰 가이드에서 보기`, `문서 타입 비교 보기`
- 목적: 국지적 도움말에서 상위 작업 흐름으로 연결
- 반복 정책: 관련 기능을 쓰는 동안만 노출

### 7.4 첫 진입 온보딩 카드

- 위치: 프로젝트가 0개인 팀, 문서가 0개인 프로젝트
- 형태: dismissible checklist card
- 목적: 첫 성공 경험 확보
- 반복 정책: 최초 1회 강노출, dismiss 이후에는 헤더/empty state 링크만 유지

## 8. 추천 이동 흐름

```text
로그인/팀 목록
  -> 헤더 가이드
  -> Guide Hero
     -> 처음 시작하기
        -> 팀 만들기
        -> 프로젝트 목록
           -> 프로젝트 없음 empty state
              -> 가이드의 프로젝트 시작 섹션
              -> 새 프로젝트 만들기
                 -> 문서 허브
                    -> 문서 없음 empty state
                       -> 문서 타입 비교
                       -> 새 ERD / Markdown / Screen Spec 만들기
```

```text
문서 편집 중 막힘
  -> 기능 내부 가이드 버튼
  -> Guide Page의 앵커 섹션(#erd-dsl, #dictionary, #document-types)
  -> 해결 CTA
  -> 원래 화면 복귀
```

## 9. 카피 방향

- "설명"보다 "다음 행동"을 앞에 둔다.
- 명사형 제목보다 동사형 제목을 우선 쓴다.
- 예: `데이터 사전`보다 `ERD에 필요한 사전을 먼저 정리하기`
- 제품 구조 설명은 짧게, 라우트 이동/버튼명은 실제 UI와 맞춘다.
- 초심자와 숙련자 모두를 위해 "3줄 요약 + 바로가기 버튼" 구조를 반복한다.

## 10. 필요한 시각 요소와 컴포넌트 패턴

- Sticky section index 또는 우측 TOC
- 현재 맥락을 보여주는 context chip
- `팀 > 프로젝트 > 문서` 흐름을 요약한 step rail
- 문서 타입 비교 카드
- annotated screenshot 또는 단순 route map
- empty state 재사용 카드
- FAQ보다 action list에 가까운 accordion

현재 코드 기준으로 재사용 가치가 높은 패턴:

- `ProjectWorkspaceHero`
- `WorkspaceEmptyState`
- `Card`, `Badge`, `Tabs`, `Accordion`
- `WorkspaceBreadcrumb`의 팀/프로젝트 맥락 모델

## 11. 구현 가드레일

- `guide`를 `WorkspaceDocumentType` 또는 `DocumentPluginId`에 넣지 않는다.
- 문서 허브 목록에 가이드 문서를 섞지 않는다.
- 헤더 진입 버튼은 전역 utility로 두고, 프로젝트별 hero에만 의존하지 않는다.
- DSL 문법/오류 가이드를 삭제하거나 통합하지 않는다. 가이드 페이지는 상위 허브다.
- 첫 진입 온보딩 카드는 한 번 닫으면 과도하게 반복 노출하지 않는다.
- 팀/프로젝트 맥락이 있을 때는 가이드 상단에 "어디서 들어왔는지"를 보여주고, 복귀 CTA를 항상 제공한다.

## 12. UX 리스크

- 가이드가 기능 설명서처럼 길어지면 실제 작업 복귀율이 떨어진다.
- 가이드를 새 문서 타입으로 넣으면 사용자 산출물과 제품 도움말의 정보구조가 충돌한다.
- 헤더 상시 진입만 두면 초심자는 못 찾고, empty state 진입만 두면 숙련자는 다시 찾기 어렵다.
- DSL/Dictionary/WBS 같은 용어를 한 페이지에 평면적으로 나열하면 현재 구조보다 더 복잡하게 느껴질 수 있다.

## 13. 구현 우선순위 제안

1. `'/guide'` 라우트와 guide shell 추가
2. 헤더 전역 진입 CTA 추가
3. `TeamsPage`, `ProjectsPage`, `DiagramsPage` empty state에 맥락형 CTA 연결
4. DSL 문법/오류 가이드에서 guide page 앵커 deep link 추가
5. 첫 진입 checklist의 dismiss 상태 저장 추가

## 14. 최종 판단

- 별도 가이드 페이지는 "문서 작성 기능"이 아니라 "문서 플랫폼 탐색 허브"로 설계해야 현재 Smart-ERD 구조와 충돌이 없다.
- 가장 중요한 UX는 예쁜 설명 레이아웃이 아니라, `현재 맥락에서 들어와서 다음 행동으로 바로 돌아가는 것`이다.
- 따라서 구현 시 핵심 성공 기준은 섹션 수가 아니라 `헤더 진입`, `empty state 진입`, `deep link 복귀` 3축이 모두 연결되는지다.
