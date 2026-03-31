# DSL Assist 팝업 — 이미 매핑된 컬럼에서 자동 팝업 억제

**작성일시:** 2026-03-03 16:08

## 문제

DSL 코드 에디터에서 Code → ERD 작업 중, 용어 사전 등록 보조 팝업(Assist Popup)이 **이미 termId가 매핑된 컬럼**에서도 자동으로 뜬다. 사용자가 타이핑할 때마다 700ms 유휴 후 `registerTerm` 항목이 포함된 팝업이 반복 노출되어 작업 흐름을 방해한다.

## 기대 동작

- 이미 정상적으로 용어 사전에 매핑된 컬럼(termId 존재)에서는 자동 팝업(autoOnly)이 뜨지 않아야 한다.
- Ctrl+Space 수동 트리거는 기존대로 동작한다 (insert 항목만 표시).

## 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `client/src/hooks/useDslEditorCompletion.ts` | `buildAssistItems()` 내 `addRegisterTerm()` 호출을 조건부로 변경 |

## 수정 내용

`buildAssistItems()` 함수의 용어 컨텍스트 블록(line 408-476)에서, `addRegisterTerm()` 호출 전에 현재 커서 행의 컬럼이 이미 용어 사전에 매핑되어 있는지 확인한다.

### 판별 로직

1. `parseResult.result.tableRanges`에서 현재 행이 속한 테이블 범위를 찾는다
2. 테이블 키워드 행(startLine)이면 `tableTermId` 확인
3. 컬럼 행이면 `colIndex = lineNum - startLine - 1`로 인덱스를 계산하여 `columns[colIdx].termId` 확인
4. termId가 존재하면 `addRegisterTerm()` 호출을 건너뜀

### 자동 팝업 억제 흐름

```
registerTerm 항목 미추가
  → items.some(item => item.type.startsWith('register')) → false
  → autoOnly 모드에서 팝업 미표시
```

## 엣지 케이스

| 시나리오 | 동작 |
|----------|------|
| 이미 매핑된 컬럼 (termId 존재) | 자동 팝업 X |
| 미매핑 컬럼 (termId 없음) | 기존과 동일 — 자동 팝업 O |
| 테이블 블록 바깥 | 기존 동작 유지 |
| 새 컬럼 추가 중 (아직 파싱 안됨) | 기존 동작 유지 |
| parseResult가 null (초기 상태) | 기존 동작 유지 |
