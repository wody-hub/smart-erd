# 개발 점검자

시니어 풀스택 개발자 관점에서 코드 품질을 점검한다. 점검 대상은 `$ARGUMENTS`이다. 인자가 없으면 최근 변경 파일(`git diff --name-only`)을 대상으로 한다.

## 점검 절차

1. 점검 대상 파일을 파악한다. 인자가 없으면 `git diff --name-only`와 `git diff --cached --name-only`로 변경 파일 목록을 수집한다.
2. 대상 파일들을 읽고 아래 체크리스트를 **백엔드/프론트엔드로 분리**하여 점검한다.
3. 점검 결과를 표 형식으로 정리하고, 위반 사항에는 **구체적인 파일:라인번호와 수정 제안**을 포함한다.

## 백엔드 체크리스트 (Java / Spring Boot)

### 1. 모던 Java 관용구 (MUST)

- [ ] `var` / `final var` 사용: RHS에서 타입이 명확한 지역 변수에 `var` 사용 여부. 재할당하지 않는 변수는 `final var`, 재할당하는 변수는 `var`
- [ ] `record` 사용: DTO, 복합키 클래스가 `record`로 정의되어 있는지
- [ ] `List.of()` 사용: 빈 불변 컬렉션에 `Collections.emptyList()` 대신 `List.of()` 사용 여부
- [ ] Stream API: `.stream().map(...).toList()` 패턴 사용 여부
- [ ] Optional: JPA 단건 조회에 `.orElseThrow()` 패턴 사용 여부

### 2. Import 규칙 (MUST)

- [ ] 와일드카드 import (`.*`) 사용 금지
- [ ] 미사용 import 존재 여부

### 3. 예외 처리 체계 (MUST)

- [ ] `IllegalArgumentException` 등 범용 예외 대신 도메인 예외 사용 여부
  - `EntityNotFoundException` (404), `AccessDeniedException` (403), `DuplicateException` (409), `BusinessException` (400)
- [ ] 예외 메시지에 식별 정보(ID, 이름 등) 포함 여부

### 4. 트랜잭션 패턴 (MUST)

- [ ] 클래스 레벨 `@Transactional(readOnly = true)` 선언 여부
- [ ] 쓰기 메서드에만 `@Transactional` 오버라이드 여부
- [ ] 읽기 전용 메서드에 불필요한 `@Transactional` 중복 선언 여부

### 5. JPA Dirty Checking (MUST)

- [ ] 엔티티 상태 변경 시 setter/도메인 메서드 사용 여부 (delete+save 패턴 금지)

### 6. Null Safety (MUST)

- [ ] 루트 패키지 `@NonNullApi` 유지 여부
- [ ] Service 클래스 `@SuppressWarnings("null")` 적용 여부

### 7. QueryDSL Custom Repository (해당 시)

- [ ] Custom Repository 인터페이스/Impl 네이밍 컨벤션 준수 여부
- [ ] Impl 클래스에 `@Repository`/`@Component` 미사용 여부
- [ ] `JPAQueryFactory` 생성자 주입 (`@RequiredArgsConstructor`) 여부
- [ ] Q클래스 static import 여부
- [ ] 단순 파생 쿼리(`findByXxx`)는 QueryDSL로 전환하지 않았는지 확인

### 8. 패키지 구조 (MUST)

- [ ] `api/` 계층: Controller + DTO만 포함 (비즈니스 로직 금지)
- [ ] `domain/` 계층: Entity, Repository, Service 위치
- [ ] DTO가 Java `record`로 작성, `@Valid` 검증 포함 여부

### 9. Gradle (해당 시)

- [ ] `annotationProcessor` 순서: Lombok → QueryDSL (Lombok이 먼저)

## 프론트엔드 체크리스트 (TypeScript / React)

### 1. 데이터 페칭 — React Query (MUST)

- [ ] 서버 상태에 `useQuery`/`useMutation` 사용 여부
- [ ] 수동 `useEffect` + `useState(loading)` 패턴 금지
- [ ] Mutation 후 `invalidateQueries`로 캐시 무효화 여부
- [ ] 에러 처리: `getErrorMessage(err, fallback)` + `toast.error()` 패턴

### 2. API 레이어 (MUST)

- [ ] 페이지에서 `axiosInstance` 직접 호출 금지. `api/` 모듈 함수 경유 여부
- [ ] API 함수에 명시적 반환 타입 + JSDoc `@param` 존재 여부

### 3. 상수 관리 — 매직 스트링 금지 (MUST)

- [ ] localStorage 키: `STORAGE_KEYS.*` 사용 여부
- [ ] 라우트 경로: `ROUTES.*` 사용 여부
- [ ] 쿼리 키: `queryKeys.*` 사용 여부
- [ ] 인라인 문자열 리터럴로 위 3종이 사용되고 있지 않은지 확인

### 4. 타입 공유 (MUST)

- [ ] 서버 응답 타입이 `types/` 디렉토리에 정의되어 있는지
- [ ] 페이지 내 인라인 타입 정의 금지

### 5. 디자인 토큰 (MUST)

- [ ] 하드코딩 색상(`bg-gray-*`, `text-blue-*`, `#hex`) 사용 금지
- [ ] 시맨틱 토큰 클래스(`bg-card`, `text-muted-foreground`, `bg-erd-*`, `bg-header` 등) 사용 여부

### 6. 접근성 (MUST)

- [ ] 아이콘 전용 버튼에 `aria-label` 존재 여부
- [ ] 토글 버튼의 `aria-label`에 대상 컨텍스트 포함 여부
- [ ] 로딩 상태에 `Spinner` 컴포넌트 사용 여부

### 7. React 19 컨벤션 (MUST)

- [ ] `React.forwardRef` 사용 금지 — `ref`는 일반 prop으로 전달 (React 19)
- [ ] `useCallback`/`useMemo` 수동 사용 지양 — React 19 compiler 자동 최적화 (단, useEffect 의존성 배열에 함수를 전달하는 경우 등 필요한 예외는 허용)

### 8. 컴포넌트 구조 (Medium)

- [ ] 2회 이상 반복 UI 패턴이 공유 컴포넌트로 추출되어 있는지
- [ ] `components/ui/`에 도메인 로직이 포함되어 있지 않은지
- [ ] `@/` alias import 사용 여부
- [ ] ESM 전용 — `require()` 사용 금지

### 9. 페이지 구조 (MUST)

- [ ] 페이지 파일이 도메인별 서브디렉토리(`pages/auth/`, `pages/team/`, `pages/project/`, `pages/diagram/`)에 위치하는지
- [ ] 페이지 컴포넌트 내부 코드가 표준 순서를 준수하는지:
  1. URL 파라미터 (`useParams`)
  2. 라우터 훅 (`useNavigate`)
  3. Query Client (`useQueryClient`)
  4. 로컬 상태 (`useState`)
  5. 스토어 셀렉터 (`useCanvasStore`, `useAuthStore`)
  6. 파생값/상수
  7. 쿼리 (`useQuery`)
  8. 뮤테이션 (`useMutation`)
  9. 이벤트 핸들러
  10. 사이드 이펙트 (`useEffect`)
  11. 조건부 리턴 (loading/error)
  12. JSX
- [ ] `useEffect`가 쿼리/뮤테이션 사이에 끼어들지 않는지

### 10. JSDoc (Medium)

- [ ] 함수/컴포넌트: 멀티라인 JSDoc + `@param`
- [ ] 인터페이스 필드: 한 줄 `/** 설명 */`
- [ ] 상태 변수 (`useState`): 선언 위에 한 줄 `/** 설명 */`
- [ ] shadcn/ui 컴포넌트(`components/ui/`)는 JSDoc 불필요

## 출력 형식

```markdown
## 개발 점검 결과

### 점검 대상
- 파일 N개: (파일 목록)

### 요약
| 영역 | 상태 | 위반 수 |
|------|------|---------|
| [BE] 모던 Java | ✅ / ⚠️ / ❌ | N |
| [BE] 예외 처리 | ... | ... |
| [FE] React Query | ... | ... |
| [FE] 디자인 토큰 | ... | ... |
| ... | ... | ... |

### 위반 상세
#### [영역명]
| 파일:라인 | 현재 코드 | 수정 제안 | 심각도 |
|-----------|-----------|-----------|--------|
| `TeamService.java:45` | `throw new IllegalArgumentException(...)` | `throw new EntityNotFoundException(...)` | MUST |
| ... | ... | ... | ... |

### 총평
(1-2문장으로 전체 상태 요약 + 우선 수정 권장 사항)
```
