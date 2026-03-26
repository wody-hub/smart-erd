# QA Access

이 문서는 `smart-erd` 저장소 전용 QA 접근 정보를 정리한다.

## 목적

- 브라우저 QA, Playwright smoke, 수동 확인 시 사용할 전용 로그인 계정을 정리한다.
- 프로필별 포트와 로그인 규칙을 한곳에서 확인한다.
- 공용 스킬 문서가 아니라 이 프로젝트 로컬 운영 문서로 사용한다.

## 전용 QA 계정

아래 계정 3개는 2026-03-26에 이 프로젝트 DB에 신규 생성한 전용 QA 계정이다.

| Login ID | 표시 이름 | 용도 |
| --- | --- | --- |
| `qa-owner@smarterd.local` | `QA Owner` | 대표 QA 로그인 ID |
| `qa-editor@smarterd.local` | `QA Editor` | 편집 시나리오 확인용 |
| `qa-viewer@smarterd.local` | `QA Viewer` | 조회/읽기 전용 시나리오 확인용 |

주의:

- 위 3개는 "로그인 계정"만 생성한 상태다.
- 특정 팀의 `OWNER/EDITOR/VIEWER` 권한이 자동 부여되지는 않는다.
- 팀 단위 권한 검증이 필요하면 앱 안에서 해당 팀 멤버로 추가하고 역할을 설정해야 한다.

## 비밀번호 정책

- `local` / `dev` 프로필에서는 실제 비밀번호가 필요하다.
- 실제 공용 QA 비밀번호는 저장소 문서에 커밋하지 않는다.
- 공용 QA 비밀번호가 필요하면 별도 비밀 저장소 또는 팀 내부 공유 채널을 사용한다.

## 프로필별 접근 규칙

| 프로필 | Backend | Frontend | 로그인 규칙 |
| --- | --- | --- | --- |
| `local` | `http://localhost:9501` | `http://localhost:4501` | 실제 비밀번호 필요 |
| `test` | `http://localhost:9502` | `http://localhost:4502` | 비밀번호 검증 우회 |
| `dev` | `http://localhost:9503` | `http://localhost:4503` | 실제 비밀번호 필요 |

`test` 프로필은 [`application-test.yml`](../src/main/resources/application-test.yml)에서
`smart-erd.auth.test-support.skip-password-verification: true` 로 설정되어 있다.
즉, 존재하는 `loginId`만 맞으면 임의의 비어 있지 않은 비밀번호로 로그인할 수 있다.

## 추천 사용 방식

빠른 UI 확인이나 gstack QA:

1. `./bootRun-test.sh`
2. `cd client && npm run test:frontend`
3. 로그인 ID는 `qa-owner@smarterd.local` 사용
4. 비밀번호는 아무 값이나 입력

실제 인증 흐름 확인:

1. `./bootRun-local.sh` 또는 `./bootRun-dev.sh`
2. 실제 공용 QA 비밀번호를 별도 비밀 채널에서 확인
3. 전용 QA 계정으로 로그인

## 제외 대상

이 문서에는 아래 계정은 적지 않는다.

- 개인 계정 (`wody@riskzero.kr`, `wody8674@naver.com` 등)
- 성능 테스트 계정 (`k6u*`, `export-perf-*`)
- 일회성 E2E 계정 (`e2e-*`, `manual-e2e-*`, `codex-temp-*`)

전용 QA 문서에는 재사용 가능한 팀용 계정만 유지한다.
