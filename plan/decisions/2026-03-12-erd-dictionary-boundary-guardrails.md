# 2026-03-12 ERD / Dictionary Boundary Guardrails

상태: 승인
작성일: 2026-03-12

## 결정

ERD 편집 기능과 사전 관리 기능은 다음 경계를 따른다.

1. ERD는 사전 "조회 데이터 계약"만 소비한다.
2. 사전 생성/수정/삭제/기본세트 변경 같은 관리 절차는 dictionary 도메인에 남긴다.
3. 공용 layout 계층은 ERD 전용 상태나 협업 UI를 직접 다루지 않는다.
4. ERD 전용 UI는 `components/erd/`에, ERD 전용 상태 접근 경로는 `stores/erd/`에 둔다.

## 이유

- 다른 메뉴나 절차 수정이 ERD 캔버스, 코드 에디터, 협업 동작에 전파되지 않게 하기 위함
- 코드 리뷰 시 허용 의존 방향을 명확히 하기 위함
- 경계가 이름과 폴더 구조에도 드러나도록 하기 위함

## 허용 의존

- `pages/diagram/*` -> `components/erd/*`
- `components/erd/*` -> `stores/erd/*`
- `components/erd/*` -> 사전 조회 계약 (`ErdDictionaryContext`, ERD 전용 dictionary data)
- `components/layout/*` -> 공용 UI, 라우팅, 인증 상태

## 금지 의존

- `components/layout/*` -> `useCanvasStore`, `useCollaborationStore`, `react-flow`, Yjs
- `components/erd/*` -> `components/dictionary/*`
- `components/erd/*` -> `pages/dictionary/*`
- ERD 내부에서 dictionary 관리 절차를 직접 조합하는 코드

## 운영 규칙

- ERD 관련 신규 상태 접근은 `stores/erd/*` 경로를 우선 사용한다.
- 사전 기능 수정 시 ERD 영향 여부를 별도 확인한다.
- 공용 layout 수정 시 다이어그램 편집 화면 회귀 여부를 확인한다.

## 후속 과제

- 필요 시 ESLint import 규칙으로 금지 의존을 자동 검출
- 기존 store 구현 본체도 장기적으로 `stores/erd/*` 아래로 이동 검토
