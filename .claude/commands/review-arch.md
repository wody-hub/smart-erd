# 아키텍처 점검자

15년차 시니어 개발자 관점에서 **구조적 설계, 공통 모듈화, 안티패턴, 웹 보안 취약점**을 점검한다. 점검 대상은 `$ARGUMENTS`이다. 인자가 없으면 최근 변경 파일(`git diff --name-only` + `git ls-files --others --exclude-standard`)을 대상으로 한다.

> 코딩 컨벤션은 `/review-convention`이, 디자인/퍼블리싱은 `/review-design`이 담당한다. 이 점검자는 **설계 수준의 구조적 문제와 보안 취약점**을 다룬다.

## 점검 절차

1. 점검 대상 파일을 파악한다. 인자가 없으면 `git diff --name-only`와 `git ls-files --others --exclude-standard`로 변경/신규 파일 목록을 수집한다.
2. 대상 파일들을 **모두 읽고** 아래 체크리스트를 기준으로 점검한다. 파일 간 의존 관계, 호출 흐름, 데이터 흐름을 추적하여 구조적 문제를 식별한다.
3. 점검 결과를 심각도별로 정리하고, 위반 사항에는 **구체적인 파일:라인번호, 문제 설명, 수정 방향**을 포함한다.

## 백엔드 체크리스트 (Java / Spring Boot)

### 1. 동시성 / 스레드 안전성 (Critical)

- [ ] `ConcurrentHashMap`, `ConcurrentHashMap.newKeySet()` 등 concurrent 자료구조를 사용하더라도 **복합 연산**(read-then-write, check-then-act)에 TOCTOU 레이스가 있는지 확인
- [ ] `synchronized` 블록의 범위가 적절한지 (너무 넓으면 병목, 너무 좁으면 레이스)
- [ ] `@Scheduled` 메서드가 공유 상태에 접근할 때 동기화 보장 여부
- [ ] WebSocket 세션의 `sendMessage`가 동기화되어 있는지 (`session` 단위 `synchronized`)

### 2. 데이터 무결성 / 영속성 (Critical)

- [ ] 인메모리 캐시/버퍼에 저장되는 데이터가 **누적 상태**(full state)인지 **단일 delta**인지 확인. 단일 delta만 저장하면 콜드 스타트 시 데이터 유실
- [ ] 인메모리 → DB 영속화 경로에 데이터 유실 가능성이 없는지 (프로세스 크래시, OOM 등)
- [ ] `@Scheduled` flush와 연결 종료 시 flush 사이에 중복 저장 또는 누락이 없는지
- [ ] DB 조회 시 N+1 쿼리 패턴이 없는지 (루프 내 `findById` 등)

### 3. 리소스 생명주기 (High)

- [ ] WebSocket 세션 정리: 비정상 종료(네트워크 끊김) 시에도 방에서 제거되는지
- [ ] 인메모리 맵(rooms, snapshots 등)에서 더 이상 필요 없는 엔트리가 적절히 제거되는지 (메모리 누수)
- [ ] 연결 종료 시 상대방에게 필요한 cleanup 메시지(Awareness null 등)가 전송되는지

### 4. 에러 복구 / 장애 격리 (High)

- [ ] 한 세션의 `sendMessage` 실패가 다른 세션의 브로드캐스트를 중단시키지 않는지
- [ ] 예외 발생 시 리소스(세션, 방, 스냅샷)가 일관된 상태로 유지되는지
- [ ] `@Scheduled` 메서드에서 예외 발생 시 스케줄러가 멈추지 않는지 (Spring 기본 동작 확인)

### 5. URL/프로토콜 파싱 견고성 (Medium)

- [ ] URL 경로 파싱이 하드코딩된 인덱스/split에 의존하지 않는지 (Spring `UriTemplate`, `AntPathMatcher` 등 활용)
- [ ] 바이너리 프로토콜 파싱 시 payload 길이 검증이 충분한지 (buffer underflow 방지)

## 프론트엔드 체크리스트 (TypeScript / React)

### 6. 상태 관리 아키텍처 (Critical)

- [ ] **단일 책임**: 하나의 스토어/모듈이 하나의 관심사만 관리하는지. 여러 관심사(캔버스 상태 + CRDT 동기화 + 직렬화)가 하나의 파일에 섞여 있지 않은지
- [ ] **SSOT(Single Source of Truth)**: 동일한 데이터가 여러 곳에 중복 저장/관리되지 않는지
- [ ] **추상화 누수**: 상위 계층(훅, 페이지)이 하위 계층(Y.Doc 내부 구조, Y.Map/Y.Array)을 직접 조작하지 않는지. 스토어 API를 우회하여 Y.Doc을 직접 건드리는 곳이 없는지

### 7. Dual-mode / 분기 안티패턴 (High)

- [ ] 동일한 로직이 조건 분기(`if (flag) { A방식 } else { B방식 }`)로 중복 구현되어 있지 않은지
- [ ] 중복 분기가 있다면: 두 경로가 실제로 모두 사용되는지 확인. 하나가 레거시라면 제거 또는 Strategy 패턴으로 분리 권장
- [ ] 새 기능 추가 시 N개의 분기를 모두 수정해야 하는 **산탄총 수술(Shotgun Surgery)** 냄새가 없는지

### 8. 리소스 정리 / 메모리 누수 (High)

- [ ] `useEffect` cleanup에서 모든 등록된 이벤트 리스너/observer가 해제되는지
- [ ] CRDT 라이브러리의 `observeDeep`/`observe` 등록 시 해제(`unobserveDeep`/`unobserve`) 대응이 있는지
- [ ] `Y.Doc.destroy()` 등 라이브러리 리소스 정리 함수가 호출되는지
- [ ] `setTimeout`/`setInterval` 정리: 모듈 스코프 타이머가 적절히 cleanup되는지

### 9. 모듈 스코프 상태 (Medium)

- [ ] Zustand/Redux 스토어 **외부**에 `let` mutable 변수가 있는지 (HMR, 다중 인스턴스 시 문제)
- [ ] 모듈 스코프 상태가 있다면 컴포넌트 unmount/remount 시 적절히 초기화되는지
- [ ] 모듈 스코프 상태가 React DevTools에서 보이지 않아 디버깅이 어렵지 않은지

### 10. 코드 중복 / 공통화 (Medium)

- [ ] 3줄 이상의 동일한 로직이 2곳 이상에서 반복되는 경우 공통 함수/훅으로 추출되어 있는지
- [ ] Y.Map 생성 패턴 (테이블, 컬럼, 엣지)이 반복된다면 빌더/팩토리 함수가 있는지
- [ ] 에러 핸들링, 토스트 메시지 등 횡단 관심사가 통일된 패턴으로 처리되는지

### 11. 의존성 방향 (Medium)

- [ ] 의존성이 **단방향**인지 확인: `pages/ → hooks/ → stores/ → collaboration/`. 역방향 의존이 없는지
- [ ] `stores/`가 `collaboration/`에 의존하는 것은 허용하지만, `collaboration/`이 `stores/`에 의존하면 순환
- [ ] 순환 의존이 있으면 인터페이스 분리 또는 이벤트 기반 통신으로 해결 권장

## 보안 취약점 체크리스트 (OWASP Top 10 기반)

### 12. 인증 / 인가 우회 (Critical)

- [ ] **WebSocket 인증 우회**: WebSocket 핸드셰이크에서 JWT 검증이 누락되거나 우회 가능한 경로가 없는지 확인
- [ ] **JWT 토큰 노출**: WebSocket URL query param에 JWT를 포함하는 경우 서버 액세스 로그, Referer 헤더, 브라우저 히스토리에 토큰이 기록되는지 확인
- [ ] **인가 검증 범위**: 핸드셰이크 시 팀 멤버십만 검증하고, 이후 메시지에서는 별도 인가 없이 relay하는 경우 — 다른 다이어그램으로의 메시지 injection이 불가능한지 확인 (diagramId가 세션에 바인딩되어 있는지)
- [ ] **토큰 만료 처리**: WebSocket 연결 수립 후 JWT가 만료되어도 연결이 유지되는 경우 — 장기 연결에서 인증 무력화 가능성 확인
- [ ] **Refresh Token 보관**: 프론트엔드에서 `localStorage`에 토큰 저장 시 XSS 공격으로 탈취 가능성 (httpOnly Cookie 대안 검토)

### 13. 입력 검증 / 인젝션 (Critical)

- [ ] **바이너리 메시지 검증**: WebSocket으로 수신한 바이너리 데이터를 검증 없이 그대로 다른 클라이언트에 relay하는 경우 — 악성 payload가 그대로 전파될 수 있는지 확인
- [ ] **메시지 크기 제한**: WebSocket 메시지에 크기 제한이 있는지 확인 (대용량 메시지로 인한 OOM 공격 방지). Spring의 `WebSocketHandler` 버퍼 사이즈 설정 확인
- [ ] **JSON 파싱 안전성**: Awareness 메시지 등 JSON 파싱 시 악의적으로 조작된 JSON(deeply nested, 초대형 문자열 등)에 대한 방어가 있는지 확인
- [ ] **SQL Injection**: Spring Data JPA 사용 시 기본적으로 안전하나, 네이티브 쿼리나 동적 쿼리 문자열 결합이 있는지 확인
- [ ] **XSS (Cross-Site Scripting)**: 사용자 입력(테이블명, 컬럼명, 사용자명 등)이 프론트엔드에서 `dangerouslySetInnerHTML` 없이 렌더링되는지 확인. React JSX는 기본적으로 이스케이프하므로, JSX 외부에서 innerHTML을 사용하는 곳이 없는지 확인

### 14. WebSocket 보안 (High)

- [ ] **CSWSH (Cross-Site WebSocket Hijacking)**: WebSocket 핸드셰이크 시 Origin 헤더 검증이 있는지 확인. `setAllowedOrigins("*")`이면 모든 사이트에서 WebSocket 연결 가능 → CSRF와 유사한 공격
- [ ] **DoS 방어 — 연결 수 제한**: 단일 사용자가 동일 다이어그램에 무한히 연결을 열 수 있는지 확인. 방당/사용자당 세션 수 제한이 있는지
- [ ] **DoS 방어 — 메시지 속도 제한**: 악의적 클라이언트가 초당 수천 개의 메시지를 전송하여 서버/다른 클라이언트를 압도할 수 있는지 확인 (rate limiting)
- [ ] **메시지 타입 검증**: 알 수 없는 메시지 타입 수신 시 적절히 무시하는지 (로그만 남기고 연결 유지). 악성 타입 코드로 서버를 crash시킬 수 없는지 확인

### 15. 데이터 노출 / 정보 유출 (High)

- [ ] **에러 메시지 정보 노출**: 예외 발생 시 스택 트레이스, 내부 경로, DB 스키마 등이 클라이언트에 노출되지 않는지 확인
- [ ] **로그 내 민감 정보**: JWT 토큰, 사용자 비밀번호 등이 서버 로그에 기록되지 않는지 확인
- [ ] **API 응답 과다 노출**: 다이어그램 조회 응답에 불필요한 내부 필드(ydocSnapshot 원문 등)가 포함되지 않는지 확인
- [ ] **CORS 설정**: `Access-Control-Allow-Origin`이 와일드카드(`*`)가 아닌 허용된 도메인만 포함하는지 확인

### 16. 의존성 / 공급망 보안 (Medium)

- [ ] **알려진 취약점**: `npm audit` 또는 `./gradlew dependencyCheckAnalyze` 등으로 알려진 CVE가 있는 의존성이 없는지 확인
- [ ] **사용하지 않는 의존성**: 불필요한 의존성이 공격 표면을 넓히고 있지 않은지 확인
- [ ] **프론트엔드 번들 노출**: 빌드 결과물에 소스맵(`.map`)이 프로덕션에서 제공되지 않는지 확인

### 17. CRDT / 실시간 협업 특화 보안 (Medium)

- [ ] **Y.Doc 조작 공격**: 악의적 클라이언트가 의도적으로 잘못된 Yjs update를 전송하여 다른 클라이언트의 Y.Doc을 corrupt시킬 수 있는지 확인 (서버가 relay만 하므로 검증 불가)
- [ ] **Awareness 스푸핑**: 다른 사용자의 clientId를 사칭하여 Awareness 메시지를 전송할 수 있는지 확인
- [ ] **방 격리**: 한 다이어그램 방의 메시지가 다른 방에 전파될 수 없는지 확인. 세션이 `diagramId`에 바인딩되어 있고, 브로드캐스트가 방 내부에서만 이루어지는지 확인

## 출력 형식

```markdown
## 아키텍처 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 요약
| # | 이슈 | 심각도 | 영역 |
|---|------|--------|------|
| 1 | (이슈 한 줄 요약) | Critical / High / Medium | BE / FE |
| ... | ... | ... | ... |

### 상세

#### 1. [심각도] 이슈 제목

**위치:** `파일명.java:라인` 또는 `파일명.ts:라인`

**문제:**
(현재 코드의 구조적 문제를 구체적으로 설명. 코드 스니펫 포함)

**영향:**
(이 문제가 야기하는 실제 시나리오 — 데이터 유실, 레이스 컨디션, 메모리 누수 등)

**수정 방향:**
(구체적인 해결 전략과 코드 수준의 제안)

---

(이슈별 반복)

### 총평
(전체 아키텍처 상태 1-3문장 요약 + 우선순위별 수정 로드맵)
```
