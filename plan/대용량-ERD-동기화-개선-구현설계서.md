# 대용량 ERD 동기화 개선 구현설계서 (Phase 1, Phase 2)

## 1. 설계 원칙
- 안정성 우선: 기능 확장보다 데이터 보존과 폴백 우선
- 점진 전환: 기존 `replaceFromDdl` 경로를 즉시 제거하지 않고 병행
- 대용량 최적화: 50/200/500 테이블 스케일 기준으로 설계
- 관측 가능성: 성능/실패 지표를 먼저 수집하고 적용

## 2. 반복 점검 실행 프로토콜 (최대 20회)
- 반복 단위:
  - Plan -> Implement(문서수정) -> Verify -> Review -> Refine
- 회차 종료 게이트:
  - Critical/High 이슈가 남아 있으면 다음 회차 진행
  - Medium 이하만 남고 수용 가능하면 종료 가능
- 회차별 필수 점검 체크리스트:
  - 아키텍처 경계/폴백/가드 누락 여부
  - 구현 가능성(파일/컴포넌트/상태 계약) 모호성 여부
  - 성능 검증 자동화 가능 여부
  - 회귀 테스트 경로 누락 여부
- 최대 20회 도달 시:
  - 잔여 이슈와 차기 최소 액션을 분리 보고

## 3. 현재 구조 요약
- 코드 파싱 결과 반영은 `replaceFromDdl(result)` 호출 중심
- 내부 동작: tables/edges 전체 삭제 후 `populateFromDdl` 재생성
- 반영 후 `applyDagreLayout`로 전체 배치 수행
- 문제점: 전체 교체 + 전체 레이아웃이 대용량에서 병목

## 4. Phase 1 상세 설계 (빠른 완화)
## 4.1 목표
- 대용량에서 UI 멈춤과 과도한 재생성 빈도 억제
- 기존 기능 호환성 유지

## 4.2 변경 항목
### A. Apply 보호 정책
- 위치: `useApplyToErd`, `DdlCodeEditorPanel`, `DslCodeEditorPanel`
- 정책:
  - `nodeCount >= LARGE_DIAGRAM_THRESHOLD`이면 자동 Apply 금지 또는 확인 모달 강제
  - 자동 동기화는 `manual-confirm` 상태로 전환

### B. 레이아웃 경량화
- 전체 레이아웃 기본 정책 변경:
  - 소형: 기존 전체 레이아웃 유지
  - 대형: 신규 생성 노드 중심 부분 배치 또는 레이아웃 생략
- 옵션 플래그:
  - `layoutMode: "full" | "incremental" | "none"`

### C. 실행 시간 계측
- 측정 지표:
  - parse-to-apply 총 시간
  - Yjs transact 시간
  - 레이아웃 시간
  - 노드/엣지 개수
- 수집 위치:
  - Apply 시작/종료 지점
  - 레이아웃 호출 전후

## 4.3 데이터 계약
- 새 정책 필드(클라이언트 상태):
  - `syncPolicy.autoApplyEnabled`
  - `syncPolicy.layoutMode`
  - `syncPolicy.largeDiagramThreshold`

### 정책 소유 및 저장 범위
- 소유 주체: 사용자 단위 설정 (팀 공통 정책 아님)
- 저장 범위: 다이어그램 단위 로컬 설정 (`teamId/projectId/diagramId` 스코프)
- 저장 위치: 로컬 스토리지
- 서버 반영: 없음 (초기 버전)
- 기본값 적용 순서:
  - 코드 기본값 -> 로컬 저장값 순으로 병합

## 4.4 테스트
- 단위:
  - 임계치 초과 시 자동 Apply 차단
  - 레이아웃 모드별 분기 검증
- 수동:
  - 50/200/500 샘플로 Apply 체감 시간 비교
  - 협업 세션 2명 이상 동시 반영 시나리오

### 성능 자동화
- `npm run perf:erd:apply` 스크립트 추가
  - 입력: `S50`, `S200`, `S500` 고정 시나리오
  - 출력: parse/apply/layout/total p50/p95 JSON 리포트
- CI 비차단 리포트 단계로 먼저 도입하고, 기준 안정화 후 차단 게이트로 전환

## 5. Phase 2 상세 설계 (디프 엔진)
## 5.1 목표
- 전체 재생성 제거, 변경분 증분 반영 전환

## 5.2 신규 컴포넌트
### A. `buildErdDiff(parsed, current)`
- 입력:
  - `parsed`: DDL/DSL 파싱 결과
  - `current`: 현재 Yjs/Store 스냅샷
- 출력:
  - `tablesToAdd`, `tablesToUpdate`, `tablesToDelete`
  - `columnsToAdd/Update/Delete`
  - `edgesToAdd/Delete/UpdateRelationType`

### B. `applyDiffToYDoc(diff, options)`
- 원자 트랜잭션으로 증분 반영
- 실패 시 예외 반환, 상위에서 `replaceFromDdl` 폴백 가능

### C. 키 매칭 전략
- 1순위: 물리명 정확 일치
- 2순위: 논리명 정규화 일치
- 3순위: 구조 시그니처(컬럼 세트) 보조 매칭
- 매칭 불확실 시 안전하게 add/delete 처리

### D. Phase 2 착수 가드
- 아래 조건 만족 전에는 `useDiffApply`를 켜지 않는다.
  - rename 판정 정책 확정
  - 그룹 재매핑 정책 확정
  - 임계치 기본값 확정

## 5.3 상태 보존 정책
- 보존 대상:
  - table id
  - table position
  - header color / logical name
  - group membership (`groups.tableIds`)
- 삭제 대상:
  - 더 이상 존재하지 않는 관계/컬럼

## 5.4 레이아웃 정책
- 업데이트/삭제만 있는 경우 레이아웃 미실행
- 추가 노드만 있을 때 신규 노드 주변 배치
- 사용자가 명시적으로 Auto Layout 실행 시에만 전체 배치

## 5.5 장애/롤백
- 디프 적용 실패 시 즉시 Full Replace 폴백
- 폴백 횟수/원인 텔레메트리 수집
- feature flag:
  - `useDiffApply = false` 기본 배포
  - 단계적 활성화(내부/베타/전체)

### Full Replace 폴백 시 그룹 처리 규칙
- 규칙 1: 그룹 객체(`groups`) 자체는 삭제하지 않는다.
- 규칙 2: 기존 그룹 멤버십은 테이블 재매칭 결과로 재구성한다.
  - exact 매칭 성공: 기존 그룹 유지
  - 불확실/미매칭: 해당 멤버십만 제거하고 그룹은 유지
- 규칙 3: 폴백 후 멤버십 변동 건수를 사용자 알림/로그로 남긴다.

## 6. 구현 순서
1. Phase 1 정책/계측/가드 적용
2. 성능 기준 수집(베이스라인)
3. Phase 2 착수 게이트 확정(rename/그룹재매핑/임계치)
4. Diff 계산기(`buildErdDiff`) 구현
5. Diff 적용기(`applyDiffToYDoc`) 구현
6. 플래그 기반 점진 전환
7. 폴백/로그/모니터링 고도화

## 7. 수용 기준 (Definition of Done)
- 기능:
  - 대형 다이어그램에서 자동 전체 재생성 억제 동작
  - Diff 기반 Apply에서 기존 메타/그룹 보존
- 품질:
  - 기존 단위/빌드 통과
  - 신규 핵심 경로 테스트 추가
- 성능:
  - 200/500 테이블에서 기준 대비 개선 지표 달성

## 8. 오픈 이슈
- 대형 다이어그램 임계치 기본값(150/300) 운영 피드백 기반 미세조정
- 성능 자동화 스크립트의 CI 차단 전환 시점 확정

## 9. 의사결정 레지스터 (반복 점검용)
- DR-01 rename 판정 정책
  - 상태: 확정 필요
  - 오너: PM + 리드 개발
  - 목표일: T+3영업일
- DR-02 그룹 재매핑 강도
  - 상태: 확정 필요
  - 오너: 아키텍트 + FE 개발
  - 목표일: T+4영업일
- DR-03 임계치 기본값(150/300)
  - 상태: 확정 필요
  - 오너: 성능 담당 + FE 개발
  - 목표일: T+5영업일
