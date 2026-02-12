# 개발 점검 체크리스트

점검 대상 파일에 해당하는 항목만 적용한다.

## 공통 체크리스트

### SonarQube 준수 (MUST)

- [ ] SonarQube/SonarLint 경고(코드 스멜, 버그, 취약점)가 없는지 확인
- [ ] `null` 대신 빈 컬렉션/빈 배열을 반환하는지 확인
- [ ] 미사용 변수/import가 없는지 확인
- [ ] 빈 `catch`로 예외를 무시하지 않고 처리/로깅하는지 확인
- [ ] 인라인 조건 반환보다 명시적 블록을 사용하는지 확인
- [ ] Prettier와 충돌하는 S1611은 예외로 취급하는지 확인

## 백엔드 체크리스트 (Java / Spring Boot)

### 1. 모던 Java 관용구 (MUST)

- [ ] RHS로 타입이 명확한 지역 변수에 `var`/`final var`를 적절히 사용하는지 확인
- [ ] DTO/복합키 값 객체에 `record` 사용이 적절한지 확인
- [ ] 불변 빈 컬렉션에 `List.of()`를 사용하는지 확인
- [ ] Stream `.stream().map(...).toList()` 패턴을 적절히 사용하는지 확인
- [ ] JPA 단건 조회에 `.orElseThrow()` 패턴을 사용하는지 확인

### 2. Import 규칙 (MUST)

- [ ] 와일드카드 import(`.*`)가 없는지 확인
- [ ] 미사용 import가 없는지 확인

### 3. 예외 처리 체계 (MUST)

- [ ] 범용 예외 대신 도메인 예외를 사용하는지 확인
- [ ] 예외 매핑을 명시적으로 적용하는지 확인: `EntityNotFoundException`(404), `AccessDeniedException`(403), `DuplicateException`(409), `BusinessException`(400)
- [ ] 예외 메시지에 식별 정보(id/name 등)를 포함하는지 확인

### 4. 트랜잭션 패턴 (MUST)

- [ ] 클래스 레벨 `@Transactional(readOnly = true)`를 읽기 중심 서비스에 적용하는지 확인
- [ ] 쓰기 메서드에만 `@Transactional` 오버라이드하는지 확인
- [ ] 불필요한 read-only 메서드 중복 선언이 없는지 확인

### 5. JPA Dirty Checking (MUST)

- [ ] 엔티티 상태 변경을 setter/도메인 메서드로 수행하고 delete+save 패턴을 피하는지 확인

### 6. Null Safety (MUST)

- [ ] 루트 패키지 `@NonNullApi`를 유지하는지 확인
- [ ] `@SuppressWarnings("null")`를 실제 경고 지점의 최소 범위에만 적용하는지 확인
- [ ] 근거 없는 클래스 레벨 null suppress가 없는지 확인

### 7. QueryDSL Custom Repository (해당 시)

- [ ] Custom Repository 인터페이스/Impl 네이밍 컨벤션을 지키는지 확인
- [ ] Impl에 불필요한 `@Repository`/`@Component`를 사용하지 않는지 확인
- [ ] `JPAQueryFactory`를 생성자 주입(`@RequiredArgsConstructor`)하는지 확인
- [ ] Q 클래스 static import를 사용하는지 확인
- [ ] 단순 파생 쿼리를 불필요하게 QueryDSL로 대체하지 않았는지 확인

### 8. 패키지 구조 (MUST)

- [ ] `api/` 계층에 Controller + DTO만 두고 비즈니스 로직을 배제하는지 확인
- [ ] `domain/` 계층에 Entity/Repository/Service를 배치하는지 확인
- [ ] DTO에 `record`와 `@Valid`를 적절히 사용하는지 확인

### 9. Gradle (해당 시)

- [ ] `annotationProcessor` 순서가 Lombok -> QueryDSL인지 확인

## 프론트엔드 체크리스트 (TypeScript / React)

### 1. 데이터 페칭 - React Query (MUST)

- [ ] 서버 상태에 `useQuery`/`useMutation`을 사용하는지 확인
- [ ] 수동 `useEffect + useState(loading)` 페칭 패턴을 사용하지 않는지 확인
- [ ] mutation 이후 관련 query를 invalidate하는지 확인
- [ ] API 에러 처리를 `getErrorMessage(err, fallback)` + `toast.error()`로 통일하는지 확인

### 2. API 레이어 (MUST)

- [ ] 페이지에서 `axiosInstance`를 직접 호출하지 않는지 확인
- [ ] `api/` 모듈 경유 + 명시적 반환 타입 + JSDoc `@param`을 사용하는지 확인

### 3. 상수 관리 (MUST)

- [ ] localStorage 키에 `STORAGE_KEYS.*`를 사용하는지 확인
- [ ] 라우트 경로에 `ROUTES.*`를 사용하는지 확인
- [ ] query key에 `queryKeys.*`를 사용하는지 확인
- [ ] 키보드 단축키에 `KEYBINDINGS.*` + `useHotkeys()`를 사용하는지 확인
- [ ] 네이티브 `addEventListener('keydown')` + 매직 스트링 사용을 피하는지 확인
- [ ] 위 항목에서 인라인 매직 스트링을 쓰지 않는지 확인

### 4. 타입 공유 (MUST)

- [ ] 서버 응답 타입을 `types/`에 정의하는지 확인
- [ ] 페이지 내부 인라인 응답 타입 정의를 피하는지 확인

### 5. 디자인 토큰 (MUST)

- [ ] 하드코딩 색상(`bg-gray-*`, `text-blue-*`, `#hex`)을 사용하지 않는지 확인
- [ ] 시맨틱 토큰 클래스(`bg-card`, `text-muted-foreground`, `bg-erd-*`, `bg-header`)를 사용하는지 확인

### 6. 접근성 (MUST)

- [ ] 아이콘 전용 버튼에 `aria-label`이 있는지 확인
- [ ] 토글 버튼 `aria-label`에 대상 컨텍스트가 포함되는지 확인
- [ ] 로딩 상태에서 `Spinner` 컴포넌트를 사용하는지 확인

### 7. React 19 컨벤션 (MUST)

- [ ] `React.forwardRef` 대신 일반 `ref` prop 전달 방식을 사용하는지 확인
- [ ] 불필요한 수동 `useCallback`/`useMemo`를 지양하는지 확인
- [ ] effect 의존성/검증된 성능 이슈가 있는 경우에만 명시적 메모이제이션을 허용하는지 확인

### 8. 컴포넌트 구조 (Medium)

- [ ] 2회 이상 반복되는 UI 패턴을 공통 컴포넌트로 추출하는지 확인
- [ ] `components/ui/`에 도메인 로직을 넣지 않는지 확인
- [ ] `@/` alias import를 일관되게 사용하는지 확인
- [ ] ESM 코드에서 `require()`를 사용하지 않는지 확인

### 9. 페이지 구조 (MUST)

- [ ] 페이지 파일을 도메인 서브디렉터리(`pages/auth/`, `pages/team/`, `pages/project/`, `pages/diagram/`)에 배치하는지 확인
- [ ] 페이지 내부 코드 순서를 일관되게 유지하는지 확인: URL params -> Router hooks -> Query client -> Local state -> Store selectors -> Derived values/constants -> Queries -> Mutations -> Event handlers -> Effects -> Conditional returns -> JSX
- [ ] `useEffect`가 query/mutation 블록 사이에 끼어들지 않는지 확인

### 10. JSDoc (Medium)

- [ ] 함수/컴포넌트에 멀티라인 JSDoc + `@param`을 작성하는지 확인
- [ ] 인터페이스 필드에 한 줄 `/** ... */`를 작성하는지 확인
- [ ] `useState` 선언 위에 한 줄 상태 설명을 작성하는지 확인
- [ ] `components/ui/` shadcn 프리미티브에는 JSDoc 강제를 제외하는지 확인
