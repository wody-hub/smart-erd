# PR Diff Review

## Scope Check
- Scope: CLEAN
- Intent: `/src/main/java/com/smarterd/api/**` 하위 코드를 riskzero SI 표준 기준으로 재점검하고 조치한다.
- Delivered: API 컨트롤러 책임 분리, OpenAPI 응답 문서화 보강, DTO schema/validation 메시지 키 보강, 전역 API 표준 회귀 테스트 추가.
- Out-of-scope risk: 현재 워크트리에는 이전 작업분이 함께 섞여 있으므로, 이 리뷰는 `api`/API 테스트/메시지 번들/README/검증 스크립트 변경 중심으로 판단했다.

## Pre-Landing Review
- Result: No blocker issues found.
- Critical categories checked:
  - SQL & Data Safety: PASS. API 계층 변경이며 신규 SQL/raw query 없음.
  - Race Conditions & Concurrency: PASS. 신규 read-check-write 또는 상태 전이 구현 없음.
  - LLM Output Trust Boundary: PASS. 신규 LLM output persistence 경로 없음.
  - Shell Injection: PASS. 신규 shell execution 없음.
  - Enum & Value Completeness: PASS. 신규 enum/status 값 없음.
- Informational categories checked:
  - API contract regression: PASS. 분리된 컨트롤러의 URL/HTTP method가 기존 경로와 동일하고 관련 MVC tests가 통과했다.
  - Completeness gaps: PASS. `ApiStandardsTest`가 controller size, OpenAPI annotation, DTO schema, validation message key를 전역 회귀로 고정한다.
  - Documentation staleness: PASS. README backend structure가 분리된 controller 목록으로 갱신됐다.

## TDD / 자동화 테스트 증거
- tdd-plan.md 존재: N
- tdd-report.md 존재: N
- RED 실패 확인: PASS. `ApiStandardsTest` 추가 직후 line size/OpenAPI/DTO validation 위반으로 실패 확인.
- GREEN 성공 확인: PASS.
- diff의 주요 동작과 테스트 연결: PASS.

## 계획 전 리서치 반영
- research.md 존재: N
- external citations: N/A
- 권장 접근과 diff 일치: N/A
- 리서치에서 경고한 위험 대응: N/A

## Verification Evidence
- `./gradlew test --tests 'com.smarterd.api.ApiStandardsTest'`: PASS
- `./gradlew test --tests 'com.smarterd.api.diagram.*' --tests 'com.smarterd.api.project.*' --tests 'com.smarterd.api.settings.*' --tests 'com.smarterd.api.team.*'`: PASS
- `./gradlew test`: PASS
- `node scripts/verify-function-docs.mjs --backend-only`: PASS
- `./scripts/check-string-utils.sh`: PASS
- `git diff --check`: PASS

## Notes
- gstack `review`의 Agent/AskUserQuestion 기반 specialist dispatch와 review-log 저장 도구는 현재 Codex 도구 목록에 노출되지 않아 수동 diff review로 대체했다.
- `.si-planning` 기능 산출물 디렉터리가 기존에 없어 `api-riskzero-si-review` 디렉터리를 새로 만들고 이 리뷰를 저장했다.
