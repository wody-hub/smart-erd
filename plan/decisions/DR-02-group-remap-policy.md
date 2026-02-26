# DR-02 그룹 재매핑 강도 정책

- 상태: 확정 (2026-02-26)
- 오너: ARCH + FE (riskzero-architecture-review-team + riskzero-development-team)
- 적용 범위: Phase 2 `applyDiffToYDoc`, Full Replace 폴백 후 그룹 재구성

## 1. 의사결정 배경

- 그룹 보존을 공격적으로 수행하면 잘못된 테이블 매핑이 그룹 오염으로 이어진다.
- 대용량에서 잘못된 그룹 오염은 수동 복구 비용이 매우 크다.
- 따라서 정확도 우선으로 보수 모드 채택이 필요하다.

## 2. 옵션 비교

### 옵션 A: 보수 모드

- high-confidence 매칭만 그룹 유지
- 불확실 매칭은 그룹 제외
- 장점: 오탐 최소화, 복구 리스크 작음
- 단점: 일부 정상 rename 케이스에서 그룹 손실 가능

### 옵션 B: 공격 모드

- medium-confidence까지 그룹 유지
- 장점: 보존율 상승 가능
- 단점: 오탐 시 대량 그룹 오염 위험

## 3. 결정

옵션 A(보수 모드)로 확정한다.

그룹 유지 조건:

1. 테이블 매칭 신뢰도 `high` (exact name 또는 DR-01 rename 승격 성공)
2. 멤버십 충돌 없음 (하나의 기존 테이블이 다수 후보에 중복 매핑되지 않음)
3. 폴백 구간에서도 동일 규칙 적용

그룹 제외 조건:

- 매칭 신뢰도 `medium/low`
- rename 거절된 케이스
- 충돌/모순 후보가 존재하는 케이스

## 4. 실패/폴백 처리 규칙

- Diff 적용 실패 시 Full Replace로 전환
- 그룹 객체(`groups`)는 유지
- `tableIds`는 high-confidence 결과만 재기입
- 제외된 멤버십 건수는 사용자 알림 + 로그 기록

로그 필수 필드:

- `group.remap.keptCount`
- `group.remap.droppedCount`
- `group.remap.dropReasons[]`

## 5. UX/운영 가드

- Apply 완료 후 멤버십 변동 요약을 비차단 토스트로 노출
- 관리자용 디버그 로그에서 그룹 재매핑 결과를 추적 가능하게 유지
- 베타 기간에는 그룹 변동률 대시보드 관찰

## 6. 재검토 조건

- 베타 2주간 `droppedCount / candidateCount` 평균이 25% 초과
- 그룹 오염(오탐) 이슈가 1건이라도 재현되면 정책 강화 유지
- 오탐 0건 + 손실률 낮음이 2주 연속 확인되면 medium 조건 제한 도입 검토
