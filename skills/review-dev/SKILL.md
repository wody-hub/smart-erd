---
name: review-dev
description: Perform senior full-stack code quality review for Java/Spring Boot and TypeScript/React using project conventions (SonarQube, architecture layering, React Query, tokens, typing, accessibility, and React 19 practices). Use when users ask for development review, convention-compliance audit, or command-style review of changed files with file:line violations and concrete fix proposals.
---

# 개발 점검

코드 품질과 컨벤션 준수 상태를 시니어 풀스택 관점에서 점검한다.

## 입력 파싱

다음 형태로 호출한다.

```text
$review-dev [paths...]
```

- 경로 인자를 0개 이상 받는다.
- 경로가 주어지면 해당 경로만 점검한다.
- 경로가 없으면 변경 파일을 수집한다.

```bash
git diff --name-only
git diff --cached --name-only
```

- 점검 전 파일 목록을 중복 제거한다.

## 점검 절차

1. 점검 대상을 식별한다.
2. 대상 파일을 읽는다.
3. 백엔드/프론트엔드 영역으로 나눠 점검한다.
4. `references/checklist.md`에서 관련 항목만 적용한다.
5. 위반 사항을 `file:line`과 수정 제안으로 정리한다.

## 점검 규칙

- `MUST` 위반을 먼저 보고하고, 이후 `Medium`을 보고한다.
- 체크리스트를 벗어난 단순 스타일 지적은 제외한다.
- 이슈가 없으면 그 사실과 잔여 테스트 공백을 명시한다.

## 출력 형식

다음 마크다운 템플릿을 사용한다.

```markdown
## 개발 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 요약
| 영역 | 상태 | 위반 수 |
|------|------|---------|
| [BE] 모던 Java | ✅ / ⚠️ / ❌ | N |
| [BE] 예외 처리 | ... | ... |
| [FE] React Query | ... | ... |
| [FE] 디자인 토큰 | ... | ... |
| ... | ... | ... |

### 위반 상세
#### [영역명]
| 파일:라인 | 현재 코드 | 수정 제안 | 심각도 |
|-----------|-----------|-----------|--------|
| `TeamService.java:45` | `throw new IllegalArgumentException(...)` | `throw new EntityNotFoundException(...)` | MUST |
| ... | ... | ... | ... |

### 총평
(1-2문장으로 전체 상태 요약 + 우선 수정 권장 사항)
```
