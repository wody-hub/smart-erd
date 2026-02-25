# ZAP 보안 취약점 조치계획

## 1. 개요

- **스캔 일시:** 2026-02-25 09:48:52
- **ZAP 버전:** 2.17.0
- **스캔 대상(개발 환경):** `http://localhost:3000` (Vite 프론트엔드), `https://firefox-settings-attachments.cdn.mozilla.net` (브라우저 외부)
- **결과 요약:** 높음 0건 / 중간 2건 / 낮음 3건 / 정보 5건 (총 10건)
- **문서 성격:** 본 문서는 개발 환경 1차 조치 계획이다. 운영 반영 완료 판단은 5.5 완료 기준(운영 경로 재스캔 포함)을 충족해야 한다.

## 2. 분류

| 분류 | 건수 | 설명 |
|------|------|------|
| 조치 필요 | 3건 | 프로덕션 배포 시 보안 헤더 추가로 해결 |
| 개발 환경 전용 | 3건 | Vite 개발 서버 한정, 프로덕션 빌드 시 자동 해결 |
| 외부 사이트 | 3건 | Mozilla CDN 관련, 프로젝트와 무관 |
| 정보성 | 1건 | SPA 구조 탐지, 조치 불필요 |

## 3. 조치 대상 상세

### 3.1 [Medium] Content Security Policy (CSP) Header Not Set

| 항목 | 내용 |
|------|------|
| CWE | CWE-693 (Protection Mechanism Failure) |
| OWASP | 2021-A05 (Security Misconfiguration) |
| 영향 | CSP 헤더 누락으로 XSS 및 데이터 인젝션 공격 방어 계층 부재 |
| 영향 URL | `GET http://localhost:3000/sitemap.xml` |

**조치 방안:**

Spring Security `SecurityConfig`에서 CSP 헤더를 설정한다.

```java
http.headers(headers -> headers
    .contentSecurityPolicy(csp -> csp
        .policyDirectives("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'")
    )
);
```

- `script-src 'self'` — 동일 출처 스크립트만 허용 (인라인 스크립트 차단으로 XSS 방어)
- `style-src 'self' 'unsafe-inline'` — Tailwind CSS의 인라인 스타일 허용
- `connect-src 'self'` — 최소 권한 원칙. 운영 환경에서는 필요한 출처만 명시적으로 허용
- `frame-ancestors 'none'` — 클릭재킹 방어 (3.2 항목과 동시 해결)

> **주의:** 개발 환경에서는 Vite HMR(`ws://localhost:3000`)과 협업 WS(`ws://localhost:8190`)가 필요할 수 있으므로, CSP는 프로파일별로 분리한다.  
> 개발 환경 예시: `connect-src 'self' ws://localhost:3000 ws://localhost:8190`

### 3.2 [Medium] Missing Anti-clickjacking Header

| 항목 | 내용 |
|------|------|
| CWE | CWE-1021 (Improper Restriction of Rendered UI Layers or Frames) |
| OWASP | 2021-A05 (Security Misconfiguration) |
| 영향 | `X-Frame-Options` 또는 CSP `frame-ancestors` 미설정으로 클릭재킹 공격 가능 |
| 영향 URL | `GET http://localhost:3000/sitemap.xml` |

**조치 방안:**

Spring Security `SecurityConfig`에서 `X-Frame-Options` 헤더를 설정한다.

```java
http.headers(headers -> headers
    .frameOptions(frame -> frame.deny())
);
```

- 3.1의 CSP에 `frame-ancestors 'none'`을 포함하면 동시 해결된다.
- `X-Frame-Options: DENY`를 별도로 설정하면 CSP 미지원 구형 브라우저도 방어 가능.

### 3.3 [Low] X-Content-Type-Options Header Missing

| 항목 | 내용 |
|------|------|
| CWE | CWE-693 (Protection Mechanism Failure) |
| OWASP | 2021-A05 (Security Misconfiguration) |
| 영향 | `X-Content-Type-Options: nosniff` 미설정으로 MIME-sniffing 공격 가능 |
| 영향 URL | `GET http://localhost:3000/vite.svg` |

**조치 방안:**

Spring Security `SecurityConfig`에서 해당 헤더를 설정한다.

```java
http.headers(headers -> headers
    .contentTypeOptions(Customizer.withDefaults())  // X-Content-Type-Options: nosniff
);
```

> **참고:** Spring Security 6.x는 기본적으로 `X-Content-Type-Options: nosniff`를 포함한다. 이 알림은 Vite 개발 서버(`localhost:3000`)가 직접 서빙하는 정적 파일에서 발생한 것이므로, 프로덕션에서 Spring Boot가 정적 자산도 서빙하거나 리버스 프록시(Nginx)를 통할 경우 자동 해결된다.

## 4. 조치 불필요 항목

### 4.1 개발 환경 전용 (프로덕션 빌드 시 자동 해결)

| 알림 | 위험도 | 원인 | 사유 |
|------|--------|------|------|
| Timestamp Disclosure - Unix | 낮음 | `react-dom` 개발 번들 내 숫자 상수 `2080374784` | Vite 개발 서버에서만 서빙, 프로덕션 빌드 시 minified |
| Sensitive Information in URL | 정보 | Vite HMR 토큰 `?token=YJhwaVCCEY3D` | 개발 서버 내부 토큰, JWT와 무관, 프로덕션에 없음 |
| Suspicious Comments | 정보 | React 개발 모드 `debug` 주석 | 프로덕션 빌드 시 minification으로 제거 |

### 4.2 외부 사이트 관련 (프로젝트와 무관)

| 알림 | 위험도 | 대상 |
|------|--------|------|
| Strict-Transport-Security Not Set | 낮음 | `firefox-settings-attachments.cdn.mozilla.net` |
| Re-examine Cache-control | 정보 | `firefox-settings-attachments.cdn.mozilla.net` |
| Retrieved from Cache | 정보 | `firefox-settings-attachments.cdn.mozilla.net` |

### 4.3 정보성 알림

| 알림 | 설명 |
|------|------|
| Modern Web Application | SPA(React) 구조 탐지. 정보 제공용이며 조치 불필요 |

## 5. 구현 계획

### 5.1 구현 위치

`SecurityConfig.java` — 기존 Spring Security 설정에 보안 헤더 구성을 추가한다.

### 5.2 통합 코드 예시

```java
final var cspPolicy = isProdProfile
    ? "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'"
    : "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self'; " +
      "connect-src 'self' ws://localhost:3000 ws://localhost:8190; " +
      "frame-ancestors 'none'";

http.headers(headers -> headers
    // [3.1] CSP — XSS/인젝션 방어 + [3.2] frame-ancestors로 클릭재킹 방어
    .contentSecurityPolicy(csp -> csp
        .policyDirectives(cspPolicy)
    )
    // [3.2] X-Frame-Options — 구형 브라우저 클릭재킹 방어
    .frameOptions(frame -> frame.deny())
    // [3.3] X-Content-Type-Options: nosniff — MIME-sniffing 방어
    .contentTypeOptions(Customizer.withDefaults())
);
```

### 5.3 프로파일 분리 고려

| 환경 | CSP 정책 | 이유 |
|------|----------|------|
| 프로덕션 | 엄격 (`'self'` + 명시적 허용 출처만) | 최소 권한 원칙, 공격면 축소 |
| 개발 | 완화 (HMR/개발 WS 출처 추가) | Vite HMR, 협업 WS, 개발 도구 지원 |

개발 환경에서 CSP가 Vite HMR이나 React Refresh를 차단할 수 있으므로, `@Profile("prod")` 분리 또는 환경별 정책 빌더 분기를 사용한다.  
`ws:`/`wss:` 스킴 와일드카드 대신 호스트를 명시적으로 적는다.

### 5.4 검증 방법

1. 백엔드 헤더 검증 (`:8190`)과 프론트 정적 경로(운영 ingress) 검증을 분리 수행한다.
2. `curl -I`로 응답 헤더 확인 (GET 엔드포인트 기준):
   ```bash
   curl -I http://localhost:8190/v3/api-docs
   curl -I http://localhost:8190/swagger-ui/index.html
   # Content-Security-Policy: ...
   # X-Frame-Options: DENY
   # X-Content-Type-Options: nosniff
   ```
3. 운영 경로 기준 검증(예: `https://<운영도메인>`):
   - SPA 정적 자산 응답 헤더
   - API 응답 헤더
   - WebSocket 연결 정책(CSP `connect-src`) 정상 동작
4. 브라우저 DevTools Network 탭에서 응답 헤더를 확인하고, ZAP 재스캔 결과를 증적과 함께 보관한다.

### 5.5 완료 기준 (Definition of Done)

1. 운영 경로(ingress) 기준 ZAP 재스캔에서 본 문서 조치 대상 3건(CSP, clickjacking, nosniff)이 해소된다.
2. CSP `connect-src`는 환경별 최소 권한 정책으로 구성되고, 스킴 와일드카드(`ws:`, `wss:`)를 사용하지 않는다.
3. 외부 사이트/개발 전용 알림은 분류 근거와 함께 예외 처리 내역을 남긴다.
4. 검증 결과(`curl` 출력, DevTools 캡처, ZAP 리포트)를 `docs/`에 보관한다.

## 6. 우선순위 / 일정

| 순서 | 작업 | 예상 범위 | 비고 |
|------|------|-----------|------|
| 1 | `SecurityConfig`에 보안 헤더 3종 추가 | `SecurityConfig.java` 1개 파일 | 3개 항목 동시 해결 |
| 2 | 개발/프로덕션 CSP 프로파일 분리 | `SecurityConfig.java` | 최소 권한 + 개발 편의성 동시 충족 |
| 3 | ZAP 재스캔으로 조치 결과 검증 | — | Medium/Low 0건 목표 |
