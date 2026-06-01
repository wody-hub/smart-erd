# RIS-350 follow-up QA 결과

- 작성일: 2026-05-06
- 대상 이슈: RIS-350
- 범위: planning API 전환 + WBS row 리팩터 회귀

## 실행 요약

- 결과: `PARTIAL PASS`
- 백엔드 핵심 회귀: PASS
- 프론트 단위 회귀: PASS
- row 시각 TMP E2E: FAIL(경계값 부동소수 오차)

## 1) 백엔드 핵심 회귀

실행:

```bash
./gradlew test \
  --tests 'com.smarterd.domain.pm.wbs.service.WbsPlanningServiceTest' \
  --tests 'com.smarterd.domain.pm.wbs.service.WbsDependencyServiceTest' \
  --tests 'com.smarterd.api.project.WbsControllerMvcTest'
```

결과:

- `BUILD SUCCESSFUL`
- planning/dependency/controller 핵심 범위 정상

## 2) 프론트 단위 회귀

실행:

```bash
cd client && npm run test:unit
```

결과:

- `# pass 350`
- `# fail 0`
- WBS row/authoring 관련 핵심 테스트 포함 통과
  - `wbs-tree-utils`
  - `wbs-inline-create`
  - `wbs-authoring-utils`
  - `wbs-dependency-summary`
  - `wbs-hierarchy-options`
  - `gantt-adapter`

## 3) row 시각 TMP E2E

실행:

```bash
cd client && \
SMART_ERD_INCLUDE_TMP_E2E=1 \
SMART_ERD_E2E_BASE_URL=http://127.0.0.1:4503 \
SMART_ERD_E2E_API_URL=http://localhost:9503/api \
npx playwright test e2e/tmp/ris-344-wbs-row-visual-unification.spec.ts --workers=1
```

결과:

- `1 failed`
- 실패 조건:
  - 기대: `Math.abs(sticky.a - rowBg.a) <= 0.2`
  - 실제: `0.20000000000000007`
- 실패 위치: `client/e2e/tmp/ris-344-wbs-row-visual-unification.spec.ts:88`
- 산출물:
  - `client/test-results/tmp-ris-344-wbs-row-visual-e02f8-ification-check-in-viewport/test-failed-1.png`
  - `client/test-results/tmp-ris-344-wbs-row-visual-e02f8-ification-check-in-viewport/trace.zip`

해석:

- UI 불일치라기보다 alpha 계산의 부동소수 표현 오차로 인한 테스트 경계 실패 가능성이 높음.
- `<= 0.2` 비교를 epsilon 보정(예: `<= 0.2001`) 또는 소수점 반올림 비교로 완화 필요.

## 판정

- 현재 상태: `PARTIAL PASS`
- blocker: row 시각 TMP E2E 스펙 경계값 취약성

## 다음 액션

- 후속 개발 이슈에서 row 시각 TMP E2E의 alpha 허용 오차 비교를 안정화 후 재실행
- 안정화 반영 후 RIS-350에서 동일 명령으로 회귀 재검증 수행

---

## 재검증 (blockers resolved 이후, 2026-05-06)

결과: `PASS`

### 실행

```bash
./gradlew test \
  --tests 'com.smarterd.domain.pm.wbs.service.WbsPlanningServiceTest' \
  --tests 'com.smarterd.domain.pm.wbs.service.WbsDependencyServiceTest' \
  --tests 'com.smarterd.api.project.WbsControllerMvcTest'

cd client && npm run test:unit

cd client && \
SMART_ERD_INCLUDE_TMP_E2E=1 \
SMART_ERD_E2E_BASE_URL=http://127.0.0.1:4503 \
SMART_ERD_E2E_API_URL=http://localhost:9503/api \
npx playwright test e2e/tmp/ris-344-wbs-row-visual-unification.spec.ts --workers=1
```

### 결과

- 백엔드 핵심 회귀: `BUILD SUCCESSFUL`
- 프론트 단위: `# pass 353 / # fail 0`
- TMP E2E: `1 passed`

판정:

- `RIS-350` 범위(서버 planning/dependency 경로 + row 시각 회귀) 재검증 PASS
