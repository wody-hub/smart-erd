---
name: review-design
description: Perform professional frontend design and publishing review focused on semantic design tokens, dark-mode compatibility, typography consistency, loading/empty-state UX, accessibility, and responsive behavior in React/Tailwind projects. Use when users ask for design review, publisher-style UI quality audit, or command-style review of frontend files with file:line violations and concrete replacements.
---

# 디자인 & 퍼블리셔 점검자

프론트엔드 UI를 디자인 시스템/퍼블리싱 관점에서 점검한다.

## 호출 방식

```text
$review-design [paths...]
```

- `paths`가 있으면 해당 경로만 점검한다.
- `paths`가 없으면 `client/src/` 전체를 점검한다.

## 점검 절차

1. `client/src/index.css`의 디자인 토큰 정의를 먼저 확인한다.
2. `client/tailwind.config.js`의 시맨틱 색상 매핑을 확인한다.
3. 점검 대상 파일을 읽고 `references/checklist.md`를 적용한다.
4. 위반 사항을 표 형식으로 정리하고 `file:line`과 수정 제안을 포함한다.

## 결과 작성 규칙

- 심각도는 `Critical`, `Medium`, `Low`를 사용한다.
- 각 위반에 `현재 코드`, `수정 제안`, `심각도`를 포함한다.
- 각 위반의 수정 제안은 가능한 한 구체적 토큰/클래스 대체안을 포함한다.
- 위반이 없으면 그 사실과 남은 점검 공백을 명시한다.

## 출력 템플릿

```md
## 디자인 & 퍼블리셔 점검 결과

### 요약
| 영역 | 상태 | 위반 수 |
|------|------|---------|
| 디자인 토큰 | ✅ / ⚠️ / ❌ | N |
| 다크 모드 | ... | ... |
| ... | ... | ... |

### 위반 상세
#### [영역명]
| 파일:라인 | 현재 코드 | 수정 제안 | 심각도 |
|-----------|-----------|-----------|--------|
| `Header.tsx:42` | `bg-gray-900` | `bg-header` | Critical |
| ... | ... | ... | ... |

### 총평
(1-2문장으로 전체 상태 요약 + 우선 수정 권장 사항)
```
