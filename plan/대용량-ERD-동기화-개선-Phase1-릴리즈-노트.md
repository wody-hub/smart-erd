# 대용량 ERD 동기화 개선 Phase 1 릴리즈 노트

작성일: 2026-02-26  
릴리즈 범위: P1-01 ~ P1-08

## 1. 주요 변경사항

- 대형 다이어그램 정책 도입
    - 경고 임계치: 150
    - 자동 Apply 제한 임계치: 300
    - 다이어그램 단위 localStorage 정책 로딩 경로 추가
- 자동 Apply 가드 도입
    - 대형 구간에서 자동 반영 차단 후 수동 확인 플로우로 전환
    - sync status에 `hold-manual-confirm` 추가
- 레이아웃 경량화
    - 소형: 기존 full 유지
    - 대형 full 요청: incremental 대체(동일 label 위치 복원)
    - `none` 모드 지원
- 텔레메트리 로그 추가
    - `parseToApplyMs`, `replaceMs`, `layoutMs`, `totalMs`
- 성능 측정 자동 스크립트 추가
    - `npm run perf:erd:apply`
    - 기본 산출물: `/tmp/smart-erd/perf/erd-apply-report.json`
    - 샘플 산출물: `npm run perf:erd:apply:sample` -> `client/perf-reports/erd-apply-report.json`

## 2. KPI (기준 리포트)

출처: `client/perf-reports/erd-apply-report.json`  
환경: Node v20.15.1, darwin arm64

| Scenario | total p50 (ms) | total p95 (ms) | parse p95 (ms) | layout p95 (ms) |
| -------- | -------------: | -------------: | -------------: | --------------: |
| S50      |          8.150 |         11.048 |          8.290 |           2.740 |
| S200     |         23.390 |         25.890 |         20.118 |           6.188 |
| S500     |         61.801 |         82.806 |         65.134 |          20.702 |

## 3. 운영/배포 참고

- Phase 1은 기존 `replaceFromDdl` 경로를 유지한 안전 완화 단계다.
- 서버 마이그레이션/DB 스키마 변경은 포함하지 않는다.
- 사용자 체감 영향은 대형 다이어그램 자동반영 빈도 감소 및 수동 확인 증가로 나타난다.

## 4. 잔여 리스크

- lint 문서 규칙(DOCS00x) 기존 부채로 CI 통합 시 gate 정합성 점검 필요
- synthetic benchmark 수치와 실제 브라우저 협업 세션 성능 차이 가능성
- 임계치(150/300)는 운영 데이터 기반 추가 보정 필요 (GATE-03 연계)

## 5. 다음 단계

- GATE-01/02/03 확정 후 Phase 2(Diff 적용기) 착수
- Phase 2에서 `replaceFromDdl` 의존도를 단계적으로 축소
