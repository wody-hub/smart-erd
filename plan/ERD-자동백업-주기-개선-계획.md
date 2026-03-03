# ERD 자동백업 주기 개선 계획

## 1. 목표
- ERD 편집 중 비정상 이탈/서버 장애 상황에서 데이터 유실 창을 줄인다.
- 현재 협업 구조(Yjs + WebSocket + Snapshot Flush)를 유지하면서 저장 부하를 통제한다.

## 2. 현황
- 프론트 자동백업 주기: 5분
- 탭 이탈 이벤트: `visibilitychange(hidden)`, `pagehide`, `beforeunload`에서 백업 시도
- 서버 스냅샷 주기 flush: 30초
- WebSocket 연결 종료(마지막 사용자 퇴장) 시 누적 update 즉시 flush

## 3. 개선안 (권고안)
- 프론트 자동백업 주기: 60초
- 변경 발생 후 유휴(Idle) 10초 시 1회 백업 트리거 추가
- 이탈 이벤트 즉시 백업 유지
- 서버 스냅샷 주기 flush 30초 유지

## 4. 상세 설계
### 4.1 백업 트리거
- 주기 트리거: 60초마다 `prepareBackup()` 결과가 있을 때만 저장
- 유휴 트리거: 마지막 변경 시점 기준 10초 무입력 시 저장
- 이탈 트리거: `visibilitychange(hidden)`, `pagehide`, `beforeunload`

### 4.2 중복/경합 제어
- `saveMutation.isPending` 또는 백업 mutex 동작 중이면 신규 백업 스킵
- 동일 해시 콘텐츠는 재저장하지 않음 (`prepareBackup`/`markBackedUp` 유지)

### 4.3 실패 처리
- 자동백업 실패 시 사용자 토스트는 기본 비노출(노이즈 방지), 내부 로그/메트릭 기록
- 이탈 이벤트 저장 실패 시 다음 접속 시 서버 스냅샷 + Yjs 동기화로 복구 시도

## 5. 운영 기준
- 모니터링 지표:
  - `autosave_success_rate`
  - `autosave_latency_p95`
  - `autosave_skip_count` (pending/mutex/unchanged)
  - `snapshot_flush_fail_count`
- 1주 관찰 후 조정:
  - 성공률 < 99%: 주기 90초로 완화 검토
  - 유실 제보 지속: 주기 45초로 단축 검토

## 6. 롤아웃
1. 코드 반영: 주기 60초 + idle 10초
2. 기본 빌드/테스트 검증
3. 개발계 환경 적용 후 강제 종료/탭 이탈 시나리오 점검
4. 운영 반영 및 1주 모니터링

## 7. 리스크 및 대응
- 브라우저 강제종료/OS 크래시: 마지막 요청 미전송 가능
  - 대응: 유휴 트리거 추가로 유실 창 축소
- 서버 비정상 종료(`kill -9`): `SmartLifecycle` flush 미실행 가능
  - 대응: 주기 flush 유지, 운영 절차에서 정상 종료 원칙 강화

