# DR-01 rename 판정 정책

- 상태: 확정 (2026-02-26)
- 오너: PM + LEAD-FE (riskzero-development-group)
- 적용 범위: Phase 2 `buildErdDiff` 매칭 단계, Full Replace 폴백 후 재매핑 단계

## 1. 의사결정 배경

- 테이블 rename을 공격적으로 자동 판정하면 잘못된 update로 데이터/메타 보존 오류가 발생할 수 있다.
- 반대로 rename을 모두 delete+add로 처리하면 그룹 멤버십과 위치 보존율이 떨어진다.
- 현재 목표는 "오탐 최소화"가 우선이며, 불확실성은 안전한 삭제+추가로 처리한다.

## 2. 결정

기본 정책은 보수형으로 확정한다.

1. 1순위: 물리명 exact 매칭이면 동일 테이블로 확정한다.
2. 2순위(rename 승격): 아래 조건을 모두 만족할 때만 rename으로 판정한다.
- 후보가 1:1로 유일하다.
- PK 컬럼 집합이 exact 일치한다.
- 컬럼 시그니처 유사도(이름+타입 기준)가 0.9 이상이다.
- 관계 시그니처(부모/자식 연결 대상)가 모순되지 않는다.
3. 위 조건 중 하나라도 불충족이면 rename으로 보지 않고 `delete+add`로 처리한다.

## 3. 예시

### rename으로 인정

- 기존: `orders`
- 신규: `purchase_orders`
- PK: `id` 동일
- 컬럼: 12개 중 11개 동일, 타입 동일
- FK 관계 대상 동일
- 후보가 유일함

결과: `orders -> purchase_orders` rename update

### delete+add로 처리

- 기존: `orders`
- 신규 후보: `purchase_orders`, `orders_archive`
- PK 동일 후보가 2개 존재

결과: 불확실하므로 rename 금지, `orders` delete + 신규 add

### delete+add로 처리 (구조 변경 과다)

- 기존: `users`
- 신규: `members`
- PK는 동일하나 컬럼 40% 이상 변경

결과: rename 금지, delete+add

## 4. 구현 가드레일

- rename 승격은 feature flag(`useDiffApply`) 활성 구간에서도 동일 규칙 적용
- rename 승격/거절 사유를 텔레메트리로 남긴다
  - `match.exact_name`
  - `match.rename_promoted`
  - `match.rename_rejected`
- `rename_rejected`는 거절 이유 코드를 반드시 포함한다
  - `non_unique_candidate`
  - `pk_mismatch`
  - `signature_below_threshold`
  - `relation_conflict`

## 5. 폴백 규칙

- Diff 적용 실패 시 Full Replace로 전환하더라도 동일한 rename 판정 규칙을 재사용한다.
- 불확실 항목은 강제 보존하지 않고 안전하게 신규로 취급한다.

## 6. 재검토 조건

다음 조건 중 하나 발생 시 DR-01 재검토한다.

- 베타 2주 동안 `rename_rejected` 비율이 30% 초과
- 사용자 피드백에서 rename 미보존 이슈가 반복(주 3건 이상)
- 500+ 테이블 대형 시나리오에서 보존율 KPI 미달
