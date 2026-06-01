# RIS-344 WBS 배경색 통일 재검증 결과

- 작성일: 2026-05-06
- 대상 이슈: RIS-344
- 목적: RIS-317 후속으로 WBS 운영형 workspace 배경색 통일 상태 재검증

## 실행 환경

- 프론트: `http://127.0.0.1:4503`
- 백엔드 API: `http://localhost:9503/api`

## 검증 1) 회귀 E2E (dedicated WBS structure authoring)

실행:

```bash
cd client && \
SMART_ERD_INCLUDE_TMP_E2E=1 \
SMART_ERD_E2E_BASE_URL=http://127.0.0.1:4503 \
SMART_ERD_E2E_API_URL=http://localhost:9503/api \
npx playwright test e2e/tmp/ris-318-wbs-structure-authoring.spec.ts --workers=1
```

결과:

- `1 passed (6.1s)`
- 기존 1차 QA에서 관찰된 timeout 재현되지 않음.

## 검증 2) 스타일 토큰/클래스 점검 (배경색 통일 관련)

대상 파일:

- `client/src/components/wbs/SortableWbsRow.tsx`
- `client/src/components/wbs/WbsInlineCreateRow.tsx`
- `client/src/components/wbs/WbsWorkspaceContent.tsx`

확인 포인트:

- 행 선택/호버/sticky action 셀 배경이 시맨틱 토큰 기반(`bg-card`, `bg-secondary`, `bg-accent`)으로 일관 적용되는지 점검
- hardcoded hex/background class 미사용 유지 확인

관찰:

- 관련 배경 스타일은 토큰 기반 클래스 사용 유지
- dedicated page 모드의 sticky action cell도 `bg-card/95` 계열로 통일 적용됨

## 판정

- `PASS` (재현되는 배경색 불일치 증상 없음)

## 검증 3) 실제 뷰포트 행 일체감 + divider 유지 자동 점검 (RIS-343 코멘트 반영)

추가 실행:

```bash
cd client && \
SMART_ERD_INCLUDE_TMP_E2E=1 \
SMART_ERD_E2E_BASE_URL=http://127.0.0.1:4503 \
SMART_ERD_E2E_API_URL=http://localhost:9503/api \
npx playwright test e2e/tmp/ris-344-wbs-row-visual-unification.spec.ts --workers=1
```

결과:

- `1 passed (4.1s)`
- 신규 TMP 스펙 `e2e/tmp/ris-344-wbs-row-visual-unification.spec.ts`로 아래를 실제 viewport DOM 기준 자동 검증:
  - 선택된 row(`tr`)와 우측 sticky action cell이 동일 RGB 계열을 유지하는지 확인
  - sticky/action 및 본문 셀 모두 inset divider shadow(`inset ...`) 유지 확인
  - 행 캡처 이미지 출력: `client/test-results/ris-344-row-viewport-check.png`

## 잔여 리스크

- 시각적 미세 차이(테마/브라우저별 알파 블렌딩)는 수동 캡처 비교 없이는 완전 배제 불가
- 필요 시 QA 계정 기준으로 다크/라이트 각각 수동 스냅샷 1회 추가 권장
