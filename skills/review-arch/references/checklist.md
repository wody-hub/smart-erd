# 아키텍처 및 보안 체크리스트

점검 대상 스택에 해당하는 항목만 적용한다.

## 목차

- [1-5 백엔드 체크리스트](#백엔드-체크리스트-java--spring-boot)
- [6-11 프론트엔드 체크리스트](#프론트엔드-체크리스트-typescript--react)
- [12-17 보안 체크리스트](#보안-취약점-체크리스트-owasp-top-10-기반)

## 백엔드 체크리스트 (Java / Spring Boot)

### 1. 동시성 / 스레드 안전성 (Critical)

- [ ] `ConcurrentHashMap`, `ConcurrentHashMap.newKeySet()` 등 concurrent 자료구조를 사용하더라도 복합 연산(read-then-write, check-then-act)에 TOCTOU 레이스가 있는지 확인
- [ ] `synchronized` 블록의 범위가 적절한지 점검
- [ ] `@Scheduled` 메서드가 공유 상태에 접근할 때 동기화 보장 여부 점검
- [ ] WebSocket 세션의 `sendMessage`가 세션 단위 동기화되어 있는지 점검

### 2. 데이터 무결성 / 영속성 (Critical)

- [ ] 인메모리 캐시/버퍼 데이터가 누적 상태(full state)인지 단일 delta인지 확인
- [ ] 인메모리 -> DB 영속화 경로에서 프로세스 크래시/OOM 시 데이터 유실 가능성 점검
- [ ] `@Scheduled` flush와 연결 종료 flush 사이 중복 저장 또는 누락 가능성 점검
- [ ] DB 조회 시 N+1 쿼리 패턴(루프 내 `findById`) 점검

### 3. 리소스 생명주기 (High)

- [ ] 비정상 종료(네트워크 끊김) 시에도 WebSocket 세션/방 정리가 되는지 점검
- [ ] 인메모리 맵(rooms, snapshots 등)에서 불필요 엔트리가 제거되는지 점검
- [ ] 연결 종료 시 peer cleanup 메시지(Awareness null 등)가 전송되는지 점검

### 4. 에러 복구 / 장애 격리 (High)

- [ ] 한 세션의 `sendMessage` 실패가 다른 세션 브로드캐스트를 중단시키지 않는지 점검
- [ ] 예외 발생 시 세션/방/스냅샷 상태 일관성 유지 여부 점검
- [ ] `@Scheduled` 예외 발생 시 스케줄러가 멈추지 않는지 점검

### 5. URL/프로토콜 파싱 견고성 (Medium)

- [ ] URL 파싱이 하드코딩 split 인덱스에 과도하게 의존하지 않는지 점검
- [ ] 바이너리 프로토콜 파싱 시 payload 길이 검증이 충분한지 점검

## 프론트엔드 체크리스트 (TypeScript / React)

### 6. 상태 관리 아키텍처 (Critical)

- [ ] 단일 책임 유지 여부 점검 (스토어/모듈이 하나의 관심사만 관리하는지)
- [ ] SSOT 유지 여부 점검 (동일 데이터의 중복 저장/관리 여부)
- [ ] 추상화 누수 여부 점검 (상위 계층이 CRDT 저수준 구조를 직접 조작하는지)

### 7. Dual-mode / 분기 안티패턴 (High)

- [ ] 조건 분기로 동일 로직이 중복 구현되어 있는지 점검
- [ ] 중복 분기 경로가 실제 사용되는지 점검하고 레거시 경로는 제거/전략화 여부 점검
- [ ] 기능 추가 시 다중 분기 동시 수정이 필요한 산탄총 수술 냄새 여부 점검

### 8. 리소스 정리 / 메모리 누수 (High)

- [ ] `useEffect` cleanup에서 등록한 리스너/observer 해제 여부 점검
- [ ] CRDT `observe`/`observeDeep`에 대응하는 `unobserve`/`unobserveDeep` 존재 여부 점검
- [ ] `Y.Doc.destroy()` 등 라이브러리 리소스 정리 함수 호출 여부 점검
- [ ] `setTimeout`/`setInterval` 및 모듈 스코프 타이머 정리 여부 점검

### 9. 모듈 스코프 상태 (Medium)

- [ ] 스토어 외부 module-scope `let` 가변 상태 존재 여부 점검
- [ ] unmount/remount/HMR에서 모듈 상태 초기화 여부 점검
- [ ] 모듈 스코프 상태로 인한 관찰성/디버깅 저하 여부 점검

### 10. 코드 중복 / 공통화 (Medium)

- [ ] 3줄 이상 동일 로직이 2곳 이상 반복될 때 공통 함수/훅 추출 여부 점검
- [ ] 반복 생성 패턴(Y.Map 등)에 빌더/팩토리 적용 여지 점검
- [ ] 에러/토스트/재시도 같은 횡단 관심사 처리 패턴 일관성 점검

### 11. 의존성 방향 (Medium)

- [ ] `pages -> hooks -> stores -> collaboration` 단방향 의존 유지 여부 점검
- [ ] `collaboration -> stores` 역방향 의존/순환 의존 여부 점검
- [ ] 순환 의존 발생 시 인터페이스 분리 또는 이벤트 기반 경계 적용 여부 점검

## 보안 취약점 체크리스트 (OWASP Top 10 기반)

### 12. 인증 / 인가 우회 (Critical)

- [ ] WebSocket 핸드셰이크 JWT 검증 누락/우회 경로 점검
- [ ] URL query JWT 사용 시 로그/Referer/히스토리 유출 위험 점검
- [ ] 핸드셰이크 이후 메시지 처리에서도 자원 바인딩 기반 인가 유지 여부 점검
- [ ] 장기 WebSocket 연결에서 토큰 만료 처리 여부 점검
- [ ] 프론트 토큰 저장(`localStorage`)의 XSS 탈취 위험 고려 여부 점검

### 13. 입력 검증 / 인젝션 (Critical)

- [ ] WebSocket 바이너리 메시지 relay 전 최소 검증 여부 점검
- [ ] WebSocket 메시지 크기 제한으로 OOM/DoS 방어 여부 점검
- [ ] JSON 파싱 시 과도한 중첩/대용량 payload 방어 여부 점검
- [ ] 네이티브/동적 쿼리 문자열 결합 SQL Injection 위험 여부 점검
- [ ] `innerHTML`/`dangerouslySetInnerHTML` 기반 XSS sink 여부 점검

### 14. WebSocket 보안 (High)

- [ ] **CSWSH (Cross-Site WebSocket Hijacking)**: Origin 헤더 검증 적용 여부를 점검하고, `setAllowedOrigins("*")` 같은 와일드카드 허용이 남아 있지 않은지 확인
- [ ] **DoS 방어 - 연결 수 제한**: 단일 사용자가 동일 다이어그램에 무한 연결을 열 수 없는지 점검 (방당/사용자당 세션 수 제한)
- [ ] **DoS 방어 - 메시지 속도 제한**: 악성 클라이언트 대량 전송(예: 초당 수천 건) 상황에서 rate limiting이 적용되는지 점검
- [ ] **메시지 타입 검증**: 알 수 없는 메시지 타입 수신 시 무시/로그 처리로 안정 동작하는지 점검 (악성 타입으로 서버 crash 방지)

### 15. 데이터 노출 / 정보 유출 (High)

- [ ] **에러 메시지 정보 노출**: 오류 응답에 스택 트레이스, 내부 경로, DB 스키마가 노출되지 않는지 확인
- [ ] **로그 내 민감 정보**: JWT/비밀번호 등 비밀값이 로그에 기록되지 않는지 확인
- [ ] **API 응답 과다 노출**: 불필요한 내부 필드(예: `ydocSnapshot` 원문)가 포함되지 않는지 확인
- [ ] **CORS 설정**: `Access-Control-Allow-Origin`이 `*`가 아닌 허용 목록 기반인지 확인

### 16. 의존성 / 공급망 보안 (Medium)

- [ ] `npm audit`/SCA/Gradle 점검으로 알려진 CVE 존재 여부 점검
- [ ] 미사용 의존성으로 공격 표면 확장 여부 점검
- [ ] 프로덕션 번들 소스맵 노출 통제 여부 점검

### 17. CRDT / 실시간 협업 특화 보안 (Medium)

- [ ] **Y.Doc 조작 공격**: 악성 클라이언트가 비정상 Yjs update를 전송해 문서를 손상시킬 수 있는지 점검 (서버 relay-only 구조 포함)
- [ ] **Awareness 스푸핑**: 다른 사용자의 clientId를 사칭한 awareness 전송 가능성 점검
- [ ] **방 격리**: 메시지가 다른 다이어그램 방으로 전파되지 않는지 확인 (세션의 `diagramId` 바인딩 및 방 내부 브로드캐스트 보장)
