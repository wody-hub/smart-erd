---
name: review-clean
description: Perform code-smell and complexity review based on Martin Fowler refactoring catalog for Java/Spring Boot and TypeScript/React codebases. Use when users ask for clean-code review, spaghetti-code detection, complexity threshold audit, or command-style review of changed files with quantified metrics and file:line refactoring proposals.
---

# 클린코드 점검자

함수/클래스 수준 코드 악취와 인지 복잡도를 점검한다.

## 호출 방식

```text
$review-clean [paths...]
```

- `paths`가 있으면 해당 경로만 점검한다.
- `paths`가 없으면 변경/신규 파일을 자동 수집한다.

```bash
git diff --name-only
git ls-files --others --exclude-standard
```

## 역할 경계

- 코딩 컨벤션은 `review-convention`이 담당한다.
- 설계/보안은 `review-arch`가 담당한다.
- 디자인/퍼블리싱은 `review-design`이 담당한다.
- 이 스킬은 함수·클래스 수준의 코드 악취와 복잡도 정량 점검에 집중한다.

## 점검 절차

1. 점검 대상을 수집하고 중복 제거한다.
2. 대상 파일을 모두 읽고 함수 단위 메트릭(길이, 중첩, 분기, 파라미터)을 계산한다.
3. `references/checklist.md`를 적용해 코드 악취를 식별한다.
4. 심각도(`High`, `Medium`, `Low`) 기준으로 결과를 정리한다.
5. 각 위반에 `파일:라인`, `코드 스니펫`, `악취 분류`, `리팩터링 제안`을 포함한다.

## 정량 기준 적용 규칙

- 임계값은 `references/checklist.md`의 `정량 기준 (Threshold)` 표를 사용한다.
- 점검 요약에 파일별 정량 메트릭 표를 포함한다.
- High 기준을 넘는 항목은 우선순위 1순위로 분류한다.

## 결과 작성 규칙

- 결과는 심각도 내림차순으로 제시한다.
- 이슈가 없으면 "발견 사항 없음"을 명시하고 잔여 리스크/테스트 공백을 기록한다.
- 리팩터링 제안에는 가능한 경우 Fowler 기법명을 명시한다.
  - 예: `Extract Method`, `Replace Nested Conditional with Guard Clauses`, `Introduce Parameter Object`

## 출력 템플릿

```markdown
## 클린코드 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 정량 메트릭

| 파일 | 줄 수 | 최대 함수 길이 | 최대 중첩 | 분기 수 최대 | 평가 |
|------|-------|---------------|----------|--------------|------|
| `파일명.ts` | 461 | 78줄 (`함수명`) | 5단계 | 14 | ⚠️ |
| ... | ... | ... | ... | ... | ... |

### 요약
| # | 악취 | 심각도 | 카탈로그 | 영역 |
|---|------|--------|----------|------|
| 1 | (이슈 한 줄 요약) | High / Medium / Low | Long Method / Deep Nesting / ... | BE / FE |
| ... | ... | ... | ... | ... |

### 상세

#### 1. [심각도] 악취 이름 — 이슈 요약

**위치:** `파일명.ts:라인`

**현재 코드:**
```언어
(문제 코드 스니펫)
```

**악취:**
(카탈로그 기준 + 구체 문제)

**리팩터링:**
(구체 기법 + 적용 방향)

---

### 총평
(1-3문장 + 우선순위 로드맵)
```

## 참고 자료

- 상세 임계값/체크리스트: `references/checklist.md`
