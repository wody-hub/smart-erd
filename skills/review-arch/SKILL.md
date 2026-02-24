---
name: review-arch
description: Perform senior-level architecture review focused on structural design, common modularization, anti-pattern detection, and OWASP-aligned security weaknesses in Java/Spring Boot and TypeScript/React codebases. Use when users ask for architecture-level review, security-risk review, or command-style review of changed files with severity-ranked findings and concrete file:line evidence.
---

# 아키텍처 점검자

구조적 설계, 공통 모듈화, 안티패턴, OWASP 기반 보안 취약점을 점검한다.

## 호출 방식

```text
$review-arch [paths...]
```

- `paths`가 있으면 해당 경로만 점검한다.
- `paths`가 없으면 변경/신규 파일을 자동 수집한다.

```bash
git diff --name-only
git ls-files --others --exclude-standard
```

## 역할 경계

- 구조 설계 수준의 문제와 보안 취약점만 다룬다.
- 코딩 컨벤션/스타일은 `review-dev`로 위임한다.
- 디자인/퍼블리싱 품질은 `review-design`으로 위임한다.

## 점검 절차

1. 점검 대상 파일을 식별한다.
2. 대상 파일을 모두 읽는다.
3. 파일 간 의존 관계, 호출 흐름, 데이터 흐름을 추적한다.
4. `references/checklist.md`에서 스택에 맞는 항목만 적용한다.
5. 위반 사항을 심각도 기준(`Critical`, `High`, `Medium`)으로 정리한다.

## 결과 작성 규칙

- 이슈를 심각도 내림차순으로 제시한다.
- 모든 이슈에 `file:line` 근거를 포함한다.
- 모든 이슈에 `문제`, `영향`, `수정 방향`을 포함한다.
- 이슈가 없으면 “발견 사항 없음”을 명시하고 잔여 리스크/테스트 공백을 적는다.

## 출력 템플릿

```markdown
## 아키텍처 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 요약
| # | 이슈 | 심각도 | 영역 |
|---|------|--------|------|
| 1 | (이슈 한 줄 요약) | Critical / High / Medium | BE / FE |
| ... | ... | ... | ... |

### 상세

#### 1. [심각도] 이슈 제목

**위치:** `파일명.java:라인` 또는 `파일명.ts:라인`

**문제:**
(현재 코드의 구조적 문제를 구체적으로 설명)

**영향:**
(데이터 유실, 레이스 컨디션, 메모리 누수, 취약점 악용 시나리오)

**수정 방향:**
(코드 수준의 구체적 해결 전략)

---

### 총평
(1-3문장 요약 + 우선순위 기반 수정 로드맵)
```
