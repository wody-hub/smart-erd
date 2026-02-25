# ZAP 인증 점검 조치계획

## 1. 개요

- **스캔 일시:** 2026-02-25 10:55:25
- **ZAP 버전:** 2.17.0
- **스캔 유형:** 인증(Authentication) 중심 패시브 스캔
- **스캔 대상(개발 환경):** `http://localhost:3000` (Vite 프론트엔드), `https://firefox-settings-attachments.cdn.mozilla.net` (브라우저 외부)
- **결과 요약:** 높음 0건 / 중간 2건 / 낮음 3건 / 정보 5건 (총 10건)
- **문서 성격:** 인증 관점 보안 점검 결과 분석 및 조치 계획. 일반 스캔 결과(`zap-보안취약점-조치계획.md`)와 교차 참조한다.

## 2. 인증 보안 평가 요약

### 2.1 인증 관련 취약점 해석 (패시브 스캔 기준)

본 인증 스캔은 패시브 스캔이므로, 아래 항목은 "징후 없음"과 "별도 검증 필요"를 구분해 해석한다.

| 점검 항목 | 결과 | 비고 |
|-----------|------|------|
| CSRF (Cross-Site Request Forgery) | 징후 없음 | JWT stateless 인증 구조. 단, 토큰 저장소가 쿠키로 전환되면 CSRF 재평가 필요 |
| Brute Force / Credential Stuffing | 검증 필요 | 패시브 스캔으로는 직접 검증 불가. 액티브/부하 테스트 필요 |
| 세션 고정 (Session Fixation) | 징후 없음 | Stateless JWT 구조로 서버 세션 ID 고정 리스크 낮음 |
| 세션 하이재킹 | 검증 필요 | 서버 세션 하이재킹 리스크는 낮지만, localStorage 토큰 탈취(XSS) 리스크는 별도 존재 |
| JWT 토큰 URL 노출 | 징후 없음 | API는 Authorization 헤더 사용. WebSocket은 JWT 대신 단기 일회용 ticket 사용 |
| 인증 우회 (Authentication Bypass) | 징후 없음 | Spring Security OAuth2 Resource Server 검증 체인 기준 |
| 비밀번호 평문 전송 | 검증 필요 | POST body 자체로는 암호화 보장 불가. 운영 HTTPS 강제 여부로 최종 판단 |
| 불충분한 토큰 만료 | 징후 없음 | Access 30분 / Refresh 24시간 + 로테이션 전략 |

### 2.2 현재 인증 아키텍처 보안 강점

| 설계 요소 | 보안 효과 |
|-----------|-----------|
| HMAC-SHA256 JWT (Access Token) | 서명 위변조 방지 |
| Refresh Token 로테이션 | 사용 시 새 토큰 발급 + 기존 폐기 → 토큰 도난 피해 최소화 |
| Stateless 세션 (`SessionCreationPolicy.STATELESS`) | 서버 세션 미사용 → 세션 고정/하이재킹 원천 차단 |
| BCrypt 비밀번호 해싱 | 레인보우 테이블 공격 방어 |
| `BearerTokenAuthenticationFilter` | Spring Security 내장 필터로 표준화된 JWT 검증 |
| Authorization 헤더 전용 토큰 전송 | URL/쿠키 토큰 노출 방지 |

## 3. 발견된 알림 분류

### 3.1 일반 스캔과 동일한 알림 (보안 헤더 관련)

아래 항목은 일반 스캔(`zap-보안취약점-조치계획.md`)에서 이미 분석 및 조치 계획이 수립된 항목과 **동일**하다. 중복 조치가 아닌 동일 조치로 해결된다.

| 알림 | 위험도 | 영향 URL | 조치 상태 |
|------|--------|----------|-----------|
| Content Security Policy (CSP) Header Not Set | 중간 | `localhost:3000/sitemap.xml` | `SecurityConfig` 반영 완료 |
| Missing Anti-clickjacking Header | 중간 | `localhost:3000/sitemap.xml` | `SecurityConfig` 반영 완료 |
| X-Content-Type-Options Header Missing | 낮음 | `localhost:3000/vite.svg` | `SecurityConfig` 반영 완료 |

> **참조:** 구현 상세는 `zap-보안취약점-조치계획.md` 3장 참고.  
> 실제 반영 파일: `src/main/java/com/smarterd/config/security/SecurityConfig.java`

### 3.2 개발 환경 전용 (프로덕션에서 자동 해결)

| 알림 | 위험도 | 원인 | 사유 |
|------|--------|------|------|
| Timestamp Disclosure - Unix | 낮음 | `react-dom` 개발 번들 내 숫자 상수 `2080374784` | Vite 개발 서버 한정, 프로덕션 빌드 시 minified |
| Sensitive Information in URL | 정보 | Vite HMR 토큰 `?token=YJhwaVCCEY3D` | 개발 서버 내부 토큰, JWT와 무관 |
| Suspicious Comments | 정보 | React 개발 모드 `debug` 주석 | 프로덕션 빌드 시 minification으로 제거 |

### 3.3 외부 사이트 관련 (프로젝트와 무관)

| 알림 | 위험도 | 대상 |
|------|--------|------|
| Strict-Transport-Security Not Set | 낮음 | `firefox-settings-attachments.cdn.mozilla.net` |
| Re-examine Cache-control Directives | 정보 | `firefox-settings-attachments.cdn.mozilla.net` |
| Retrieved from Cache | 정보 | `firefox-settings-attachments.cdn.mozilla.net` |

### 3.4 정보성 알림

| 알림 | 설명 |
|------|------|
| Modern Web Application | SPA(React) 구조 탐지. 정보 제공용이며 조치 불필요 |

## 4. 추가 권장 사항 (ZAP 미탐지 영역)

패시브 스캔의 한계로 ZAP이 자동 탐지하지 못하는 인증 보안 영역에 대해 수동 점검 또는 액티브 스캔을 권장한다.

### 4.1 Rate Limiting / Brute Force 방어

| 항목 | 현황 | 권장 |
|------|------|------|
| 로그인 시도 제한 | 미구현 | `/api/auth/login` 엔드포인트에 IP 또는 계정 기반 Rate Limiting 적용 |
| 계정 잠금 정책 | 미구현 | N회 연속 실패 시 일시적 계정 잠금 또는 지연 응답 |
| CAPTCHA | 미구현 | 반복 실패 시 CAPTCHA 챌린지 도입 고려 |

**구현 방안 (선택지):**

- **Spring Boot 자체:** 인터셉터 또는 필터에서 IP별 시도 횟수를 인메모리(또는 Redis) 카운터로 관리
- **리버스 프록시:** Nginx `limit_req_zone` 지시어로 외부에서 처리
- **Spring Cloud Gateway:** Rate Limiter 필터 적용 (마이크로서비스 전환 시)

### 4.2 토큰 저장소 보안

| 항목 | 현황 | 위험도 | 권장 |
|------|------|--------|------|
| Access Token 저장 위치 | `localStorage` | 낮음 | XSS 공격 시 토큰 탈취 가능. CSP 적용으로 XSS 자체를 방어하여 위험 완화 |
| Refresh Token 저장 위치 | `localStorage` | 낮음 | httpOnly 쿠키 전환 시 XSS 토큰 탈취 원천 차단 가능 (CSRF 방어 필요) |

> **현재 판단:** CSP 헤더 적용(3.1 조치)으로 XSS 공격면이 축소되므로 현 단계에서는 `localStorage` 유지. 향후 보안 강화 시 httpOnly 쿠키 전환을 검토한다.

### 4.3 Refresh Token 보안 강화

| 항목 | 현황 | 권장 |
|------|------|------|
| 로테이션 전략 | 구현됨 (사용 시 새 토큰 발급 + 기존 폐기) | 적절 |
| Refresh Token 재사용 감지 | 미확인 | 이미 사용된 Refresh Token 재사용 시 해당 사용자의 모든 토큰 무효화 권장 |
| Refresh Token 바인딩 | 미구현 | 토큰 발급 시 IP/User-Agent를 기록하여 변경 시 재인증 요구 고려 |

### 4.4 HTTPS 강제 (프로덕션)

| 항목 | 현황 | 권장 |
|------|------|------|
| HSTS 헤더 | 미설정 (개발 환경 HTTP) | 프로덕션 배포 시 `Strict-Transport-Security: max-age=31536000; includeSubDomains` 추가 |
| HTTP → HTTPS 리다이렉트 | 미구현 | 리버스 프록시 또는 Spring Security에서 HTTPS 강제 리다이렉트 설정 |

## 5. 구현 계획

### 5.1 즉시 조치 (완료)

보안 헤더 3종은 일반 스캔 조치와 동일하며 `src/main/java/com/smarterd/config/security/SecurityConfig.java`에 이미 반영 완료.

| 항목 | 파일 | 상태 |
|------|------|------|
| CSP 헤더 | `src/main/java/com/smarterd/config/security/SecurityConfig.java` | 반영 완료 |
| X-Frame-Options: DENY | `src/main/java/com/smarterd/config/security/SecurityConfig.java` | 반영 완료 |
| X-Content-Type-Options: nosniff | `src/main/java/com/smarterd/config/security/SecurityConfig.java` | 반영 완료 |

### 5.2 단기 권장 (우선순위 높음)

| 순서 | 작업 | 예상 범위 | 비고 |
|------|------|-----------|------|
| 1 | 로그인 Rate Limiting | 필터/인터셉터 1개 추가 | Brute Force 방어 |
| 2 | Refresh Token 재사용 감지 | `AuthService` 수정 | 토큰 도난 감지 |
| 3 | 프로덕션 HSTS 헤더 추가 | `SecurityConfig.java` | HTTPS 강제 |

### 5.3 중장기 권장 (보안 강화)

| 순서 | 작업 | 예상 범위 | 비고 |
|------|------|-----------|------|
| 1 | httpOnly 쿠키 기반 Refresh Token | `AuthService` + Axios 인터셉터 | XSS 토큰 탈취 원천 차단 |
| 2 | Refresh Token IP/UA 바인딩 | `RefreshToken` 엔티티 확장 | 도난 토큰 사용 제한 |
| 3 | ZAP 액티브 스캔 수행 | — | 패시브 스캔 미탐지 영역 보완 |

### 5.4 검증 방법

1. ZAP 인증 재스캔으로 기존 Medium/Low 알림 해소 확인
2. Rate Limiting 구현 후 연속 로그인 시도 테스트 (N회 초과 시 429 응답)
3. Refresh Token 재사용 시나리오 테스트 (이미 사용된 토큰 재전송 → 전체 무효화 확인)
4. 프로덕션 배포 후 HTTPS 강제 및 HSTS 헤더 확인

### 5.5 완료 기준 (Definition of Done)

1. 운영 경로 기준 ZAP 인증 재스캔에서 보안 헤더 3건이 해소된다.
2. 로그인 Rate Limiting이 적용되어 N회 연속 실패 시 429(또는 정책 정의 응답)로 제한된다.
3. Refresh Token 재사용 감지 시나리오가 테스트로 검증된다.
4. 운영 환경에서 HTTPS 강제 및 HSTS 헤더가 검증된다.
5. 개발 전용/외부 사이트 알림은 분류 근거와 함께 예외 처리 내역을 남긴다.
6. 검증 결과를 `docs/`에 보관한다.
