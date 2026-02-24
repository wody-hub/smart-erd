# Code-to-ERD 문법 오류 하이라이팅 기능 설계 (Rev. 3.3)

본 설계안은 기존 기초 수준 설계에서 발견된 문제점들(SQL 정규화 길이 오차, 타입 전파 누락, 프론트엔드 리소스 누수 등)에 대해 3가지 종합 아키텍처 점검 결과(`@review-arch`, `@review-dev`, `@review-design`) 및 다각도 분석자(Claude, Codex)의 의견을 100% 반영하여 수정한 최종 구현 스펙입니다.

## 목표

Code-to-ERD 기능의 에디터 경험을 향상시킵니다. 현재는 문법이 틀린 DSL 줄은 조용히 무시되거나, SQL DDL의 경우 에디터 밖 하단 텍스트로만 오류 메시지가 출력되어 정확한 위치를 파악하기 어렵습니다. 이를 개선하여 오류 위치를 에디터 내부에 실시간으로 시각적 강조 표시(Squiggles)합니다.

---

## 제안하는 변경 사항

### 프론트엔드 - 연결 타입 및 전파 범위

#### [MODIFY] `DdlParseResult` 타입 파급 (SSOT 및 안정성 보장)

- 새로운 인터페이스 `DdlDiagnostic` 추가 (`messageKey`, `messageArgs`, `location` 객체 포함).
    - 다국어 일관성을 위해 DSL과 동일한 객체 기반 에러 키워드 명세를 따릅니다.
    - **[Medium] 파서 타입 독립성 확보**: 파서 레이어는 Monaco 종속 필드명(`startLineNumber`)을 사용하지 않고, UI 중립 좌표 스키마를 사용합니다.
    - **[Medium] 좌표 규약 명시**: `location` 속성은 **1-based** 로깅을 원칙으로 하며, `endColumn`은 **exclusive (미포함)** 규칙을 따릅니다.
    ```ts
    interface DdlDiagnostic {
        messageKey: string;
        messageArgs?: Record<string, string>;
        severity: 'error' | 'warning';
        location?: {
            line: number; // 1-based
            startColumn: number; // 1-based
            endColumn: number; // 1-based, exclusive
        };
    }
    ```
- `DdlParseResult` 타입에 `diagnostics: DdlDiagnostic[]` 배열 추가.
    - **컴파일 파급 방어**: 해당 타입 변경으로 인한 연쇄 에러를 막기 위해 내부/외부 모든 리턴 부위(`useDdlParse.ts` 초기화, `parseDdl` 모든 실패/빈출력 분기)에 `diagnostics: []` 빈 배열 맵핑을 필수 적용합니다.
    - **DSL SSOT 원칙**: DSL 파서의 마커 렌더링 소스는 `DslParseResult.diagnostics` 단일 경로만 사용합니다. DSL 응답 시 `result.diagnostics`는 명시적으로 빈 배열(`[]`)로 고정하여 혼동 여지를 없앱니다.
    - **비-위치 오류 처리 규칙**: `location`이 없는 진단(예: parser load failed)은 에디터 마커를 생성하지 않고, 하단 오류 텍스트(`errors`)로만 노출합니다.

### 프론트엔드 - DDL 파서 로직 (`ddl-parser.ts`)

- **[High] Chunk 오프셋 보정**: 전체 파싱 실패 후 문장 단위 분할 재파싱으로 넘어갈 때, 분리된 `SqlStatementChunk`가 원래 문자열 기준에서의 `startOffset` (시작 문자열 인덱스)와 행/열(Line/Column) 오프셋을 갖도록 `splitSqlStatements` 로직을 확장합니다.
- **[High] 🌟 정규화 좌표 보정 모순 해결 및 단일화**:
    - `normalizeDdlForParser` 함수(Postgres Identity 지원 등)가 원본 SQL의 글자 수를 치환하여 발생시키는 좌표 오차 문제에 대하여, **단일 해결책인 "해당 라인(Line) 전체 마킹 전략"만 사용**합니다.
    - **[Medium / Low] Fallback 적용 범위 및 매직 넘버 보완**: 정규화 여부를 판별하는 복잡도를 줄이기 위해, **모든 SQL 파싱 오류 마커**는 해당 라인 전체를 강조하는 것으로 통일하여 UX를 일관되게 맞춥니다. 또한 임의의 숫자 1000 대신, Monaco API 연동 시 `startColumn: 1, endColumn: model.getLineMaxColumn(location.line)`를 사용하여 라인 길이에 동기화된 안전한 마킹을 수행합니다.

### 프론트엔드 - DSL 파서 로직 (`dsl-parser.ts`)

- `IDLE` 상태에서 잘못된 텍스트 인식 시 오류 배열에 푸시합니다. 단, 에러 오탐 방지를 위해 **단독 중괄호 `{` 라인은 합법적인 구문 규칙으로 취급하여 예외(Whitelist) 처리**합니다.
- `IN_TABLE` 상태에서 반환값이 null인 잘못된 속성(Column) 선언 시 오류 배열에 기록합니다.

### 프론트엔드 - UI/UX 에디터 컴포넌트 (`DdlCodeEditorPanel.tsx`, `DslCodeEditorPanel.tsx`)

- **[Medium] 리소스 생명주기 (마커 관리 + 안전성)**:
    - `onMount` 핸들러를 이용해 `monaco`, `editor` 인스턴스 참조를 확보합니다. (DSL은 이미 존재, SQL 쪽에 추가)
    - `useEffect`를 이용하여 `parseResult.diagnostics`를 관찰하고 `monaco.editor.setModelMarkers(model, owner, [...])` API를 호출합니다.
    - **파서/뷰 변환 계층 고정**: `DdlDiagnostic -> Monaco.editor.IMarkerData` 변환은 에디터 컴포넌트(뷰 어댑터)에서만 수행합니다.
    - **SSOT 의존성 및 Cleanup 완벽 적용**:
        - 의존성 배열에 `parseResult` 자체를 직접 할당(`useMemo` 누락 방지).
        - 두 에디터 컴포넌트 모두 `return () => { ... }` cleanup 함수 내부에서 반드시 **`model.isDisposed()`를 먼저 검사**한 후 빈 배열을 넘겨 기존 마커 잔상을 명시적으로 제거합니다.

### 프론트엔드 - 다국어(i18n) 적용

- JSON의 **중첩 구조(Nested Structure)**를 파괴하지 않고 정확한 경로에 에러 메시지를 주입합니다.
    - 경로 1: `erd -> dsl -> error -> syntaxError` (DSL 전용)
    - 경로 2: `erd -> ddlImport -> parseErrorDetails` (DDL 전용, `{{details}}` 변수 포함)

---

## 검증(테스트) 계획

### 수동 검증 시나리오

1. **DSL 에디터 패널**:
    - `Tabl user` 입력 시 해당 줄 전체에 붉은 밑줄 마커 발생 확인.
    - 단축 표기를 위한 단독 `{` 줄 입력 시 에러로 처리되지 않음(의도된 동작) 확인.
    - 탭 이동 및 창 종료 시 에러 툴팁 잔상이 없는지 확인(`cleanup` 동작).
    - **[Low] 테마 전환 검증**: 에디터를 vs-dark(다크 모드) ↔ vs(라이트 모드) 사이클 전후로 에러 마커 색상이 정상적으로 반전 및 가시성이 확보되는지 점검.
2. **SQL DDL 에디터 패널**:
    - 고의 오타 삽입 (`CREATE TABEL users...`) 후 "TABEL"이 포함된 해당 문장 줄 전체가 마킹되는지(Fallback) 확인.
    - `GENERATED ALWAYS AS IDENTITY` 처럼 정규화되어 글자수가 줄어들/늘어나는 긴 문장 내에 오타 삽입 시 오류 표시 마커가 다른 라인으로 침범하지 않고 대상 라인만 통째로 정확히 가리키는지 점검. (좌표 오프셋 보정 확인)

### 단위 테스트 요구사항

- **기능 검증 (`splitSqlStatements`)**:
    - 반환 객체 Chunk가 원본 문자열의 `startOffset`, `startLine` 값을 가지고 있는지 확인.
- **예외 검증 (`parseDsl`)**:
    - `IDLE` 상태 진입기에서 `{` 문자만 포함된 라인을 만났을 때 `diagnostics` 배열에 에러가 추가되지 않는 로직(Length === 0) 검증.
- **UI/클린업 검증 명세 (`DdlCodeEditorPanel`, `DslCodeEditorPanel`)**:
    - 컴포넌트 언마운트 시 `model.isDisposed()`를 체크하고 마커를 삭제하는 `cleanup` 발동 여부 코드상 점검.
    - `location` 없는 DDL 진단이 발생했을 때 마커는 생성되지 않고 하단 에러 메시지만 노출되는지 검증.
