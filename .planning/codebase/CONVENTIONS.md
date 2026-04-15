# Coding Conventions

**Analysis Date:** 2026-04-02

## Naming Conventions

### Backend (Java)

**Classes:**
- PascalCase: `DiagramService`, `TeamController`, `EntityNotFoundException`
- Suffix 규칙: Service (`DiagramService`), Controller (`TeamController`), Repository (`DiagramRepository`), UseCase (`SaveDiagramUseCase`)
- Custom Repository: `XxxRepositoryCustom` (인터페이스) + `XxxRepositoryCustomImpl` (구현체)
- DTO: Java `record` 타입 사용 (`TeamMemberId`, request/response DTO)

**Methods:**
- camelCase: `findByIdWithOwner()`, `validateAndConsume()`
- 조회: `find*`, `fetch*`, `get*`
- 변경: `save*`, `create*`, `update*`, `delete*`, `change*`
- 검증: `validate*`, `check*`

**Variables:**
- `var` / `final var` 사용 (타입이 RHS에서 명확한 경우)
- `final var` = 재할당 없는 변수, `var` = 재할당 있는 변수
- 예: `final var user = findUserByLoginId(loginId);`

**Packages:**
- Base package: `com.smarterd`
- `api/` = HTTP interface layer (Controller + DTO only)
- `domain/` = 비즈니스 로직 (Entity + Repository + Service)
- `config/` = 설정 클래스
- `application/` = UseCase 클래스

### Frontend (TypeScript/React)

**Files:**
- Components: PascalCase (`TableNode.tsx`, `ProtectedRoute.tsx`)
- Hooks: camelCase `use` prefix (`useInlineEdit.ts`, `useFkConnectMode.ts`)
- API modules: camelCase + `Api` suffix (`teamApi.ts`, `diagramApi.ts`)
- Stores: camelCase `use` prefix + `Store` suffix (`useAuthStore.ts`, `useCanvasStore.ts`)
- Types: camelCase domain name (`team.ts`, `diagram.ts`)
- Constants: camelCase (`query-keys.ts`, `keybindings.ts`)
- Test files (unit): kebab-case (`erd-diff-apply.test.ts`)
- Test files (E2E): kebab-case + `.spec.ts` (`diagram-loading.spec.ts`)

**Functions:**
- camelCase: `fetchTeams()`, `createTeam()`, `handleSave()`
- API 함수: `fetch*`, `create*`, `update*`, `delete*` prefix
- 이벤트 핸들러: `handle*` prefix

**Variables/Constants:**
- 상수 객체: camelCase (`queryKeys`, `KEYBINDINGS`, `STORAGE_KEYS`, `ROUTES`)
- State: camelCase (`deleteTarget`, `isLoading`)

**Types/Interfaces:**
- PascalCase: `Team`, `TeamMember`, `TableNodeData`, `DiffPlan`

## Code Style

### Formatting (Prettier)

- Config: `.prettierrc.json` (루트)
- Plugin: `prettier-plugin-java` (Java + TypeScript 통합 포맷팅)

**Java:**
- `tabWidth: 4`, `printWidth: 120`

**TypeScript/TSX:**
- `tabWidth: 2`, `printWidth: 100`, `singleQuote: true`

**공통:**
- `semi: true`, `trailingComma: "all"`, `bracketSpacing: true`
- `arrowParens: "always"`, `endOfLine: "lf"`

**포맷팅 명령:**
```bash
npm run format                # 전체 (Java + TypeScript)
npm run format:java           # Java만
npm run format:client         # TypeScript만
npm run format:check          # CI용 체크
```

### Linting (ESLint)

- Config: `client/eslint.config.js`
- 기반: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`
- Plugins: `react-hooks`, `react-refresh`, `prettier`
- Key rules:
  - `react-hooks/rules-of-hooks` + `exhaustive-deps` (recommended)
  - `react-refresh/only-export-components`: warn (allowConstantExport)
  - `prettier/prettier`: warn

```bash
cd client && npm run lint     # ESLint + verify-function-docs
```

### SonarQube

- Config: `sonar-project.properties`
- S1611 (lambda parentheses) 전역 무시 (Prettier 우선)
- null 반환 대신 빈 컬렉션/빈 배열 반환
- 사용하지 않는 변수/import 제거
- 예외를 무시하지 않고 적절히 처리 또는 로깅

## Import Rules

### Backend (Java)

- **와일드카드 임포트 (`.*`) 금지** --- 모든 import는 명시적
- static import는 Q클래스에 사용: `import static com.smarterd.domain.xxx.entity.QXxx.xxx;`
- Prettier가 save 시 자동 정렬, VS Code `organizeImports`가 미사용 import 제거

### Frontend (TypeScript)

**순서:**
1. Node.js 내장 모듈 (`node:test`, `node:assert`)
2. 외부 라이브러리 (`react`, `@tanstack/react-query`, `yjs`)
3. 내부 모듈 (`@/` alias)
4. 상대 경로 (`./`, `../`)

- `@/` alias 사용 필수: `@/components/ui/button`, `@/lib/utils`
- ESM only (`"type": "module"`) --- `require()` 금지

## Error Handling

### Backend Exception Hierarchy

모든 예외는 `LocalizedException`을 상속하며 message code + args를 통해 i18n 해석.

| Exception | HTTP Status | 용도 |
|-----------|-------------|------|
| `EntityNotFoundException` | 404 | 엔티티 조회 실패 |
| `DomainAccessDeniedException` | 403 | 권한 부족 (미소속, 비ADMIN) |
| `DuplicateException` / `ConflictException` | 409 | 중복 리소스 |
| `TooManyRequestsException` | 429 | 요청 횟수 초과 (로그인 속도 제한 등) |
| `BusinessException` | 400 | 비즈니스 규칙 위반 |

- Base class: `com.smarterd.domain.common.exception.LocalizedException`
- Handler: `com.smarterd.api.common.GlobalExceptionHandler`

**올바른 패턴:**
```java
throw new EntityNotFoundException("error.not-found.user", loginId);
throw new DuplicateException("error.duplicate.login-id", request.loginId());
```

**금지 패턴:**
```java
throw new EntityNotFoundException("User not found: " + loginId);  // 하드코딩 금지
throw new IllegalArgumentException(...);                           // 도메인 예외 사용
```

### Backend Error Response Format

```json
{ "error": "사용자를 찾을 수 없습니다: testuser" }
```
- `Accept-Language` 헤더에 따라 다국어 메시지 반환
- `MessageSource` + `Locale`로 해석

### Frontend Error Handling

- `onError`에서 `toast.error(getErrorMessage(err, t('key')))` 패턴 통일
- `getErrorMessage()` 유틸: `client/src/lib/api-error.ts`
- 인라인 에러 표시 금지 --- 항상 `toast.error()` 사용

```typescript
onError: (err) => toast.error(getErrorMessage(err, t('teams.createError'))),
```

## Transaction Pattern (Backend)

- 클래스 레벨: `@Transactional(readOnly = true)` --- 기본 읽기 전용
- 메서드 레벨: `@Transactional` --- 쓰기 작업에만 override
- JPA Dirty Checking 활용: setter로 상태 변경, delete+save 금지

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DiagramService {

    @Transactional
    public void updateDiagram(...) {
        member.changeRole(request.role());  // dirty checking
    }
}
```

## Null Safety (Backend)

- 루트 `package-info.java`에 `@NonNullApi` 선언 (`com.smarterd`)
- 하위 패키지 전체 non-null by default
- null 허용 시 `@Nullable` 명시
- `@SuppressWarnings("null")` --- `src/main/` 금지, `src/test/`에서만 허용
- SonarQube null 경고 시 `Objects.requireNonNull(...)` 가드 추가

## Documentation (JSDoc/Javadoc)

### Backend (Javadoc)

- 모든 Service, UseCase, Entity 클래스에 클래스 레벨 Javadoc
- `@param`, `@returns` 사용
- 필드에 `/** 설명 */` single-line 주석

### Frontend (JSDoc)

- **모든 함수/컴포넌트/인터페이스에 JSDoc 필수**
- 함수: multi-line JSDoc + `@param` + `@returns`
- Interface 필드: single-line `/** 설명 */`
- State 변수 (`useState`): single-line `/** 설명 */`
- 상수: top-level `/** 설명 */` + 각 필드 설명
- shadcn/ui 컴포넌트 (`components/ui/`): auto-generated, JSDoc 불요

```typescript
/**
 * 팀에 멤버를 초대한다.
 *
 * @param teamId  대상 팀 ID
 * @param loginId 초대할 사용자 로그인 ID
 * @param role    부여할 역할
 */
export async function inviteMember(teamId: string, loginId: string, role: string): Promise<void> { ... }
```

**검증 스크립트:** `scripts/verify-function-docs.mjs` --- `check` task에 포함됨

## i18n (Internationalization)

### Backend

- `Spring MessageSource` 기반
- 번들 위치: `src/main/resources/i18n/messages.properties` (en), `messages_ko.properties` (ko)
- `AcceptHeaderLocaleResolver`로 `Accept-Language` 헤더에서 locale 해석
- 예외 message code: `"error.not-found.user"` 형식
- Bean Validation: `@NotBlank(message = "{validation.not-blank.login-id}")`

### Frontend

- `react-i18next` (`i18next` + `LanguageDetector`)
- 설정: `client/src/i18n/index.ts`
- 번역 파일: `client/src/i18n/locales/{en,ko}/translation.json` (~200 keys each)
- Key convention: `{domain}.{screen}.{usage}`
- **하드코딩 문자열 금지** --- 항상 `t('key')` 사용
- `useTranslation()` 위치: `useQueryClient` 다음 (Page Component Code Ordering 규칙)
- Type augmentation: `client/src/i18n/i18next.d.ts` (번역 키 자동 완성)
- Axios 인터셉터가 모든 요청에 `Accept-Language: i18n.language` 헤더 자동 첨부

## Page Component Code Ordering (Frontend)

페이지 컴포넌트 내부 코드는 반드시 다음 순서로 정렬:

| 순번 | 그룹 | 예시 |
|------|------|------|
| 1 | URL 파라미터 | `useParams` |
| 2 | 라우터 훅 | `useNavigate` |
| 3 | Query Client | `useQueryClient` |
| 3.5 | 다국어 | `useTranslation` |
| 4 | 로컬 상태 | `useState` |
| 5 | 스토어 셀렉터 | `useCanvasStore`, `useAuthStore` |
| 6 | 파생값/상수 | computed values |
| 7 | 쿼리 | `useQuery` |
| 8 | 뮤테이션 | `useMutation` |
| 9 | 이벤트 핸들러 | `handleSave` |
| 10 | 사이드 이펙트 | `useEffect` |
| 11 | 조건부 리턴 | loading/error early return |
| 12 | JSX | `return (...)` |

## Magic String 금지 (Frontend)

| 카테고리 | 상수 | 파일 |
|----------|------|------|
| localStorage keys | `STORAGE_KEYS.*` | `client/src/constants/storage.ts` |
| Route paths | `ROUTES.*` | `client/src/constants/routes.ts` |
| Query cache keys | `queryKeys.*` | `client/src/constants/query-keys.ts` |
| Keyboard shortcuts | `KEYBINDINGS.*` | `client/src/constants/keybindings.ts` |

인라인 문자열 리터럴 금지 --- 항상 상수 참조.

## Styling (Frontend)

- CSS Variable 기반 디자인 토큰 체계
- `index.css` (:root / .dark) -> `tailwind.config.js` -> 시맨틱 클래스
- **하드코딩 색상 (`bg-gray-*`, `text-blue-*`, `#hex`) 금지**
- shadcn/ui 토큰: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground` 등
- ERD 전용 토큰: `bg-erd-table-header`, `text-erd-pk`, `text-erd-fk` 등
- 새 색상 추가: `index.css` CSS Variable -> `tailwind.config.js` 매핑 -> 시맨틱 클래스

## Accessibility (Frontend)

- 아이콘 전용 버튼: `aria-label` 필수
- 토글 버튼: `aria-label`에 대상 컨텍스트 포함
- form 요소: `<label>` 연결 불가 시 `aria-label` 추가

## Data Fetching (Frontend)

- 서버 상태: React Query (`useQuery` / `useMutation`) 필수
- 수동 `useEffect` + `useState(loading)` 패턴 금지
- Mutation 후: `invalidateQueries`로 캐시 무효화
- 페이지에서 `axiosInstance` 직접 호출 금지 --- `api/` 모듈 함수 경유

```typescript
// 올바른 패턴
const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: fetchTeams,
});

const createMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
        toast.success(t('teams.createSuccess'));
    },
    onError: (err) => toast.error(getErrorMessage(err, t('teams.createError'))),
});
```

## QueryDSL Custom Repository Pattern (Backend)

```text
XxxRepository (interface) extends JpaRepository<Xxx, Id>, XxxRepositoryCustom
XxxRepositoryCustom (interface)          --- QueryDSL 메서드 시그니처
XxxRepositoryCustomImpl (class)          --- QueryDSL 구현체 (JPAQueryFactory 주입)
```

- Impl 클래스에 `@Repository`/`@Component` 붙이지 않음
- `JPAQueryFactory`는 `@RequiredArgsConstructor`로 생성자 주입
- Q클래스는 static import
- Spring Data 파생 쿼리 메서드는 QueryDSL로 전환하지 않음

---

*Convention analysis: 2026-04-02*
