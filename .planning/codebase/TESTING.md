# Testing Patterns

**Analysis Date:** 2026-04-02

## Test Framework

### Backend

**Runner:**
- JUnit 5 (JUnit Platform) + Spring Boot Test
- Config: `build.gradle` (`useJUnitPlatform()`)

**Assertion Library:**
- AssertJ (`assertThat()` 스타일)

**Mocking:**
- Mockito (`@ExtendWith(MockitoExtension.class)`, `@Mock`, `when()`, `verify()`)

**Run Commands:**
```bash
./gradlew test                                                    # 전체 테스트
./gradlew test --tests "com.smarterd.SomeTest.methodName"         # 단일 테스트
./gradlew build                                                   # 빌드 + 테스트
./gradlew clean build                                             # 클린 리빌드
```

### Frontend Unit Tests

**Runner:**
- Node.js 내장 test runner (`node:test`)
- **Vitest/Jest 미사용** --- 순수 Node.js `node --test`

**Assertion Library:**
- Node.js 내장 `node:assert` (`strict` mode)

**Run Command:**
```bash
cd client && npm run test:unit
```

**빌드 프로세스:**
1. `.tmp-test` 디렉토리 삭제
2. `tsc -p tsconfig.test.json`으로 TypeScript 컴파일 (outDir: `.tmp-test`)
3. `scripts/rewrite-test-aliases.mjs`로 `@/` alias를 상대 경로로 변환
4. `node --test .tmp-test/test/unit` 실행

### Frontend E2E Tests

**Runner:**
- Playwright (`@playwright/test` ^1.58.2)
- Config: `client/playwright.config.ts`

**Run Commands:**
```bash
cd client && npm run test:e2e                                     # 전체 E2E
cd client && npm run test:e2e:smoke                               # smoke 테스트만
cd client && npm run test:e2e:smoke:collaboration                 # 협업 smoke만
cd client && npm run test:e2e:recovery                            # recovery 테스트
```

## Test File Organization

### Backend (55개 테스트 파일)

**Location:** `src/test/java/com/smarterd/` (소스 미러 구조)

**Naming:** `{ClassName}Test.java`

**구조:**
```
src/test/java/com/smarterd/
├── SmartErdApplicationTests.java                        # 스프링 부트 통합 테스트
├── api/
│   └── diagram/
│       ├── DiagramControllerTest.java                   # 통합 테스트
│       ├── DiagramControllerMvcTest.java                # MockMvc 단위 테스트
│       └── WsTicketControllerTest.java
├── application/
│   ├── collaboration/command/
│   │   ├── ValidateCollaborationTicketUseCaseTest.java
│   │   ├── IssueCollaborationTicketUseCaseTest.java
│   │   └── PersistCollaborationSnapshotUseCaseTest.java
│   └── diagram/command/
│       ├── SaveDiagramAuthoritativeContentUseCaseTest.java
│       ├── SaveDiagramUseCaseTest.java
│       └── CompleteDiagramSessionJoinUseCaseTest.java
├── collaboration/channel/
│   └── CollaborationWebSocketRegistrationValidatorTest.java
├── config/persistence/
│   ├── LoginIdAuditorAwareTest.java
│   └── PrettySqlFormatTest.java
└── utils/excel/
    └── ExcelWriterDownloadTest.java
```

### Frontend Unit Tests (49개 테스트 파일)

**Location:** `client/test/unit/` (별도 디렉토리, co-located 아님)

**Naming:** kebab-case `{feature-name}.test.ts`

**구조:**
```
client/test/unit/
├── erd-diff-apply.test.ts
├── erd-diff-plan.test.ts
├── dsl-parser-word-resolution.test.ts
├── diagram-collaboration-provider-connection.test.ts
├── diagram-collaboration-provider-events.test.ts
├── diagram-collaboration-provider-session.test.ts
├── canvas-edge-handle-normalization.test.ts
├── code-mode-snapshot-persist.test.ts
├── word-composition.test.ts
├── diff-apply-rollout.test.ts
└── ... (총 49개)
```

### Frontend E2E Tests (20개 spec 파일 + 3개 헬퍼 파일)

**Location:** `client/e2e/`

**구조:**
```
client/e2e/
├── smoke/                                     # smoke 테스트
│   ├── diagram-loading.spec.ts
│   ├── diagram-collaboration.spec.ts
│   ├── diagram-dictionary-management.spec.ts
│   ├── diagram-work-mode-three-account-collaboration.spec.ts
│   └── ... (15+ 파일)
├── recovery/                                  # recovery 테스트
│   ├── diagram-restart-recovery.spec.ts
│   ├── diagram-save-reload-reconnect.spec.ts
│   ├── diagram-recovery-lock.ts               # 헬퍼
│   └── diagram-recovery-scenarios.ts          # 시나리오 정의
├── shared/                                    # 공유 유틸리티
│   └── diagram-e2e.ts                         # E2E 헬퍼 함수
└── tmp/                                       # 임시 테스트 (기본 무시)
```

## Test Patterns

### Backend Unit Test Pattern (Mockito)

```java
@ExtendWith(MockitoExtension.class)
class SaveDiagramAuthoritativeContentUseCaseTest {

    @Mock
    private DiagramSnapshotService diagramSnapshotService;

    @Test
    void execute_updatesContentAndSchedulesRealtimeReconcile() {
        // Arrange: UseCase를 직접 생성자로 인스턴스화
        final var useCase = new SaveDiagramAuthoritativeContentUseCase(diagramSnapshotService, ...);
        final var diagram = Diagram.builder().name("D").content("{\"nodes\":[]}").build();
        ReflectionTestUtils.setField(diagram, "id", 42L);

        // Act
        useCase.execute(diagram, "{\"nodes\":[{\"id\":\"n1\"}]}", new byte[]{1,2,3});

        // Assert (AssertJ)
        assertThat(diagram.getContent()).isEqualTo("{\"nodes\":[{\"id\":\"n1\"}]}");
        verify(diagramSnapshotService).reconcileRealtimeStateWithPersistedContentAfterCommit(42L, snapshot);
    }
}
```

**주요 특징:**
- `@ExtendWith(MockitoExtension.class)` 사용 (Spring context 미로드)
- UseCase를 직접 `new`로 생성 (DI 없이 순수 단위 테스트)
- `@Mock`으로 의존성 주입
- `when().thenReturn()` + `verify()` 패턴
- `ReflectionTestUtils.setField()`로 ID 등 설정
- `Diagram.builder()` 패턴으로 테스트 엔티티 생성
- 메서드명: `methodName_expectedBehavior` 형식 (underscore 구분)

### Backend MockMvc Test Pattern

```java
@ExtendWith(MockitoExtension.class)
class DiagramControllerMvcTest {

    @Mock
    private DiagramService diagramService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new DiagramController(diagramService, ...);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(...)  // JWT principal resolver
            .build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void saveDiagram_returns200WithVersion() throws Exception {
        when(diagramService.saveDiagram(...)).thenReturn(new SaveDiagramResult(...));

        mockMvc.perform(put("/teams/{teamId}/projects/{projectId}/diagrams/{diagramId}", 1, 2, 3)
                .contentType(APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
                .with(authentication(...)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentRevision").value(5));
    }
}
```

**주요 특징:**
- `MockMvcBuilders.standaloneSetup()` (슬라이스 테스트 없이 직접 구성)
- `authentication()` post-processor로 JWT 인증 시뮬레이션
- `jsonPath()` 응답 검증

### Backend Integration Test (Testcontainers)

- `spring-boot-testcontainers` + `testcontainers:postgresql`
- `SmartErdApplicationTests.java`: 전체 Spring context 로드 테스트
- Testcontainers가 임시 PostgreSQL 자동 생성/폐기

### Frontend Unit Test Pattern (Node.js Test Runner)

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as Y from 'yjs';
import { applyDiffToYDoc } from '../../src/lib/erd-diff-apply.js';

// 헬퍼 함수로 테스트 데이터 생성
function createDoc(seed: { tables: SeedTable[]; edges: SeedEdge[] }): Y.Doc { ... }

test('applyDiffToYDoc 는 증분 반영 후 테이블/관계/그룹 무결성을 유지한다', () => {
    const doc = createDoc({ tables: [...], edges: [...] });
    const result = applyDiffToYDoc(doc, buildPlanForApplyScenario());

    assert.equal(result.applied, true);
    assert.equal(result.appliedOperations > 0, true);
    assert.deepEqual(tableIds, ['table-1']);
});
```

**주요 특징:**
- `node:test`의 `test()` 함수 사용 (describe/it 대신 flat test)
- `node:assert` strict mode (`assert.equal`, `assert.deepEqual`)
- 테스트 이름: 한글로 행동 설명 (예: `'applyDiffToYDoc 는 증분 반영 후...'`)
- 헬퍼 함수를 테스트 파일 상단에 정의
- 외부 mock 라이브러리 미사용 --- 순수 함수 위주 테스트
- `.js` 확장자로 import (TSC 컴파일 후 실행이므로)

### Frontend E2E Test Pattern (Playwright)

```typescript
import { expect, test } from '@playwright/test';
import {
    captureDiagramReady,
    diagramUrl,
    loginViaUi,
    resolveTargetDiagram,
    getE2EConfig,
} from '../shared/diagram-e2e';

test('diagram first entry renders for a real project @smoke', async ({ page }) => {
    const config = getE2EConfig();
    const token = await loginViaUi(page, config);
    const target = await resolveTargetDiagram(token, config);

    const result = await captureDiagramReady(page, diagramUrl(config, target));
    await expect(result.node).toBeVisible();
    expect(result.visibleMs).toBeLessThan(30_000);
});
```

**주요 특징:**
- `client/e2e/shared/diagram-e2e.ts`에 공유 헬퍼 집중
- `loginViaUi()`: UI를 통한 로그인
- `resolveTargetDiagram()`: API로 테스트 대상 다이어그램 자동 탐색
- `captureDiagramReady()`: 다이어그램 로딩 완료 캡처
- 환경변수로 설정: `SMART_ERD_E2E_LOGIN`, `SMART_ERD_E2E_PASSWORD`, `SMART_ERD_E2E_BASE_URL`
- `test.info().annotations.push()`로 메타데이터 기록

### Playwright Config 주요 설정

```typescript
// client/playwright.config.ts
{
    testDir: './e2e',
    fullyParallel: false,          // 순차 실행
    timeout: 180_000,              // 3분
    expect: { timeout: 15_000 },   // expect 타임아웃 15초
    use: {
        ...devices['Desktop Chrome'],
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
}
```

## Mocking Conventions

### Backend

- **Framework:** Mockito
- **주입 방식:** `@Mock` + `@ExtendWith(MockitoExtension.class)`
- **Spring Context 미로드** --- UseCase/Service를 직접 `new`로 생성
- `ReflectionTestUtils.setField()`로 JPA ID 필드 설정
- `Builder` 패턴으로 엔티티 생성

### Frontend Unit Tests

- **외부 mock 라이브러리 미사용**
- 순수 함수/로직 위주 테스트 (DOM 테스트 없음)
- Yjs `Y.Doc`을 직접 생성하여 테스트 데이터 구성
- 헬퍼 함수(`createDoc`, `buildPlanForApplyScenario`)로 테스트 fixture 생성

## Coverage

**Requirements:** 명시적 커버리지 목표 없음 (설정 파일에 커버리지 도구 미감지)

**Backend:** JaCoCo 미설정 (build.gradle에 JaCoCo 플러그인 없음)

**Frontend:** 커버리지 도구 미설정 (Node.js test runner 기본 사용)

## Performance Testing

**ERD Apply 성능 테스트:**
```bash
cd client && npm run perf:erd:apply
```
- 시나리오: S50, S200, S500 (테이블 수)
- 15회 반복, 2회 워밍업
- 결과: `/tmp/smart-erd/perf/erd-apply-report.json`
- 샘플: `client/perf-reports/erd-apply-report.json`

## Documentation Verification

**함수 문서 검증 스크립트:**
```bash
node scripts/verify-function-docs.mjs              # 변경된 파일의 JSDoc/Javadoc 검증
node scripts/verify-function-docs.mjs --all         # 전체 파일 검증
```
- `check` task에 포함됨 (`./gradlew check` 시 자동 실행)
- `cd client && npm run lint` 시에도 실행

## Test Types Summary

| 유형 | Framework | 파일 수 | 위치 | 명령 |
|------|-----------|---------|------|------|
| Backend Unit | JUnit 5 + Mockito | 55 | `src/test/java/com/smarterd/` | `./gradlew test` |
| Backend Integration | Testcontainers | (위에 포함) | `src/test/java/com/smarterd/` | `./gradlew test` |
| Frontend Unit | Node.js test runner | 49 | `client/test/unit/` | `npm run test:unit` |
| Frontend E2E | Playwright | 23 | `client/e2e/` | `npm run test:e2e` |
| Performance | Custom script | - | `client/scripts/perf/` | `npm run perf:erd:apply` |

---

*Testing analysis: 2026-04-02*
