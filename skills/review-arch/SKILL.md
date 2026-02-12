---
name: review-arch
description: Perform senior-level architecture review focused on structural design, common modularization, anti-pattern detection, and OWASP-aligned security weaknesses in Java/Spring Boot and TypeScript/React codebases. Use when users ask for architecture-level review, security-risk review, or command-style review of changed files with severity-ranked findings and concrete file:line evidence.
---

# 아키텍처 점검

구조적 설계와 보안 취약점을 중심으로 아키텍처 수준의 문제를 점검한다.

## 입력 파싱

다음 형태로 호출한다.

```text
$review-arch [paths...]
```

- 경로 인자를 0개 이상 받는다.
- 경로가 주어지면 해당 경로만 점검한다.
- 경로가 없으면 변경/신규 파일을 수집한다.

```bash
git diff --name-only
git ls-files --others --exclude-standard
```

## 점검 절차

1. 점검 대상을 식별한다.
2. 대상 파일을 모두 읽는다.
3. 파일 간 의존성, 호출 흐름, 데이터 흐름을 추적한다.
4. `references/checklist.md`에서 스택에 맞는 항목만 적용한다.
5. 심각도 기반 위반 사항을 정리한다.

## 점검 규칙

- 이 점검자는 구조적 문제와 보안 취약점에 집중한다.
- 컨벤션/코딩 표준은 `review-dev`, 디자인/퍼블리싱은 `review-design`이 담당한다.
- 각 이슈에 `file:line`, 문제 설명, 영향, 수정 방향을 반드시 포함한다.
- 심각도는 `Critical`, `High`, `Medium`만 사용한다.
- 이슈가 없으면 그 사실과 잔여 리스크/테스트 공백을 명시한다.

## 출력 형식

다음 마크다운 템플릿을 사용한다.

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
(데이터 유실, 레이스 컨디션, 메모리 누수, 취약점 악용 가능성 등)

**수정 방향:**
(코드 수준의 구체적 해결 전략)

---

### 총평
(1-3문장 요약 + 우선순위 기반 수정 로드맵)
```
