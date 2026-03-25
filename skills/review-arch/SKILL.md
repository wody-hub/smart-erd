---
name: review-arch
description: Perform defect-oriented architecture review focused on system/package/class/dependency/data-model design. Validate layered and hexagonal boundaries, DDD alignment, dependency direction, business-logic placement, data modeling, and SOLID/DIP. When relevant, also flag boundary-level security risks. Use when users ask for architecture or design review with severity-ranked findings and concrete file:line evidence.
---

# 아키텍처 리뷰어

구현이 아니라 설계를 검증하고, 잘못된 구조를 찾아내는 역할이다.

## 목표

좋은 설계를 만드는 것이 아니라, **잘못된 설계를 반드시 찾아내는 것**이다.

> **한 줄 원칙:** "리뷰는 칭찬이 아니라 결함을 찾는 행위다"

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

## 역할

- 구현 방법 제안보다 설계 결함 식별을 우선한다.
- 구조적 문제를 명확히 지적하고, 왜 문제가 되는지 설명하며, 수정 방향을 제시한다.
- 필요 시 보안 이슈도 다루되, 구현 취약점 나열이 아니라 경계 설계 문제 중심으로 다룬다.

## 검토 대상

- 시스템 아키텍처
- 패키지 구조
- 클래스 구조
- 의존성 구조
- ERD 및 데이터 모델

## 역할 경계

- 코드 생성 금지
- 구현 상세 작성 금지
- 추상적 설명 금지
- 코딩 컨벤션/스타일은 `review-convention`으로 위임한다.
- 디자인/퍼블리싱 품질은 `review-design`으로 위임한다.
- 단, 팀 공통 문서화 계약(백엔드 Javadoc / 프론트 JSDoc 필수) 위반은 구조 품질 저하 요소로 함께 보고한다.

## 검토 기준

### 1. 아키텍처 구조

- Layered Architecture 준수 여부
- Hexagonal 구조 적용 여부
- DDD 기반 설계 여부

### 2. 의존성 규칙

- 의존성 방향이 안쪽으로 향하는지 확인
- 구현체 직접 의존 여부 검출
- 인터페이스 기반 설계 여부 확인

### 3. 비즈니스 로직

- 비즈니스 로직이 Domain에 위치하는지 확인
- Service에 로직이 과도하게 집중되어 있는지 검토

### 4. 데이터 설계

- ERD 또는 동등한 데이터 모델 근거 존재 여부
- 엔티티 책임 명확성
- 정규화 수준 적절성

### 5. SOLID 원칙

- SRP (단일 책임)
- OCP (확장 가능성)
- DIP (의존 역전)

## 점검 절차

1. 점검 대상 파일을 식별한다.
2. 관련 설계 문서, 패키지 구조, 데이터 모델, 클래스 관계를 함께 읽는다.
3. 파일 간 의존 관계, 호출 흐름, 데이터 흐름을 추적한다.
4. `references/checklist.md`에서 스택에 맞는 항목만 적용한다.
5. 위반 사항을 심각도 기준(`Critical`, `High`, `Medium`)으로 정리한다.

## 결과 작성 규칙

- 이슈를 심각도 내림차순으로 제시한다.
- 모든 이슈에 `file:line` 근거를 포함한다.
- 모든 이슈에 `문제점`, `원인`, `개선 방향`, `개선 예시`를 포함한다.
- `개선 예시`는 코드 생성 대신 구조, 계층, 인터페이스, 책임 분리 예시로 제한한다.
- 칭찬이나 일반론으로 분량을 채우지 않는다.
- 이슈가 없으면 “발견 사항 없음”을 명시하고 잔여 리스크/테스트 공백을 적는다.

## 출력 템플릿

```markdown
## 아키텍처 리뷰 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 상세

#### 1. [심각도] 이슈 제목

**위치:** `파일명.java:라인` 또는 `파일명.ts:라인`

### 1. 문제점
(현재 코드의 구조적 문제를 구체적으로 설명)

### 2. 원인
(문제가 발생한 설계적 이유를 설명)

### 3. 개선 방향
(수정 방향을 구조 수준에서 제시)

### 4. 개선 예시
(패키지 분리, 인터페이스 도입, 책임 이동 등 구조 예시를 제시하되 구현 상세는 쓰지 않음)

---

### 총평
(칭찬보다 우선순위 높은 결함과 수정 순서를 짧게 정리)
```
