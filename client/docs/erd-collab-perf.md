# ERD 협업 모드 동시 작업 성능 하네스

기존 프런트와 백엔드에 접속해 실제 UI 편집과 DOM 반영 시간을 측정한다.
제품 코드, 서버 설정, 기존 E2E 파일을 변경하지 않는다. 서버를 시작하거나 종료하지 않는다.
하나의 Chromium 안에 독립 BrowserContext K개를 만들며 각 컨텍스트가 같은 계정으로 UI 로그인한다.

## 실행

작업 위치는 `client/`다. 테스트 프로필 백엔드 `http://localhost:9502/api`, Vite
`http://localhost:4502`와 격리된 `smarterd_e2e` DB가 이미 준비되어 있어야 한다.
하네스는 DB 이름을 확인하거나 바꾸지 않으므로 실행자가 격리된 환경을 선택해야 한다.

```sh
# 기능 확인: S10, K=2. C1은 작업 종류별 3회, C3은 각 충돌 검사 1회.
npm run perf:erd:collab -- \
  --scenarios C1,C3 --seed-size 10 --clients 2 --iterations 3 \
  --duration-s 3 --out ./perf-reports/erd-collab-smoke.json

# 다른 smoke가 끝난 뒤 실행할 크기별 측정 예시
npm run perf:erd:collab -- \
  --scenarios C1,C2,C3,C4 --seed-size 10,50,200,500 \
  --clients 4 --iterations 10 --duration-s 30 --rate 2 \
  --out ./perf-reports/erd-collab-baseline.json

# 브라우저 경로를 직접 지정하는 경우
npm run perf:erd:collab -- \
  --scenarios C2 --seed-size 50 --clients 2 --duration-s 5 --rate 1 \
  --chromium-path '/Users/j.jaeyo/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
```

`duration-s`는 C2 편집 부하 창과 C4 내부 C2 부하 창에만 적용한다. 로그인, 시드,
C1의 `4 × iterations` 작업, C3의 안정성 확인, 전파 타임아웃과 정리는 별도 시간이 든다.
따라서 `--duration-s 3`이 전체 프로그램을 3초 안에 종료한다는 뜻은 아니다.
C1/C3의 부하는 `--iterations`로 줄일 수 있다(C3 검사는 항상 종류별 한 번이다).

| 옵션              | 기본값                                    | 의미                                                 |
| ----------------- | ----------------------------------------- | ---------------------------------------------------- |
| `--scenarios`     | `C1,C2,C3,C4`                             | 실행할 시나리오를 쉼표로 지정                        |
| `--seed-size`     | `10`                                      | `10,50,200,500` 중 한 개 또는 목록. `S10,S50`도 허용 |
| `--clients`       | `2`                                       | 상주 클라이언트 K. 2~16이며 N 이하여야 함            |
| `--duration-s`    | `5`                                       | 작성자별 편집 창(초), 0.1~3600                       |
| `--rate`          | `1`                                       | C2 작성자 한 명당 목표 편집 수/초, 0.1~50            |
| `--iterations`    | `3`                                       | C1의 각 편집 종류별 반복 횟수 M, 1~1000              |
| `--timeout-ms`    | `5000`                                    | UI 동작/전파 관찰/수렴 대기 제한. 500~60000          |
| `--base-url`      | `http://localhost:4502`                   | 이미 실행 중인 로컬 프런트                           |
| `--api-url`       | `http://localhost:9502/api`               | 이미 실행 중인 로컬 API. `/api` 포함                 |
| `--chromium-path` | 자동 탐색                                 | Chromium 실행 파일                                   |
| `--out`           | `./perf-reports/erd-collab-baseline.json` | JSON 경로. 확장자는 `.json`                          |
| `--help`          | 없음                                      | 도움말 출력                                          |

작성자 수 × rate × duration은 한 시나리오에서 최대 20,000으로 제한한다. 잘못된 옵션은
브라우저 실행 전에 종료 코드 1로 거부한다. 서버 주소는 localhost/loopback만 허용한다.
`SMART_ERD_E2E_*`의 로그인 자격증명과 고정 fixture ID는 사용하지 않는다. 매번 새 계정을 만든다.

Chromium 탐색은 기존 `erd-app-bench.mjs` 방식에 따라 Playwright 기본 설치를 먼저 확인하고,
`PLAYWRIGHT_BROWSERS_PATH`, macOS와 Linux의 Playwright 캐시에서 버전 숫자가 가장 큰
`chromium-*`를 찾는다. 기본 Playwright 브라우저가 없어도 캐시의 chromium-1234를 사용할 수 있다.
브라우저 다운로드는 수행하지 않는다.

## 준비와 시드 검증

각 N/시나리오 조합마다 새 계정·팀·사전·프로젝트·다이어그램을 만든다.
C1에서 추가된 테이블이나 C3의 충돌 이력이 C4의 문서 크기에 섞이지 않는다.

1. `e2e/shared/diagram-e2e.ts`의 `provisionCollaborationFixture`를 직접 재사용한다.
   기존 TS 파일을 TypeScript로 메모리 내 ESM 변환해 로드하므로 복제본이나 임시 JS 파일이 없다.
2. `scripts/perf/lib/erd-app-seed.mjs`의 결정적 시드를 사용한다. 테이블당 8~12 컬럼과
   약 1.2N 관계선이라는 구성은 기존 앱 벤치와 같다.
3. 첫 K 테이블을 측정 영역의 작은 격자에 놓고, 나머지는 기존 격자 형태를 유지하면서 아래로
   옮긴다. 대상 컬럼이 피어 화면에서 culling되는 문제를 피한다. 따라서 기존 앱 벤치와 배치는 다르다.
4. 로그인한 첫 클라이언트의 토큰으로 다이어그램 `PUT` API에 `content`를 저장한다.
   협업 페이지는 아직 열지 않은 상태다.
5. 첫 클라이언트가 다이어그램을 열면 기존 앱의 `DiagramContentOnlySnapshotSeeder`가
   content를 Y.Doc으로 부트스트랩하고 스냅샷을 서버에 저장한다. 이후 WebSocket에 연결한다.
6. 상세 API에서 content가 시드와 동일하고 `hasYdocSnapshot=true`,
   `snapshotRevision === contentRevision`인지 확인한다. 최대 10초 기다린다.
7. 나머지 K−1 컨텍스트를 각각 UI 로그인시키고 같은 다이어그램에 접속시킨다.
   모든 페이지에서 `waitForEditableDiagram`을 사용한다. 각 피어의 사이드바 테이블 수 N과
   첫 K 테이블의 컬럼 ID/이름도 시드와 비교한다.
8. 사이드바 포커스(zoom 1.2)와 실제 마우스 pan으로 공통 측정 영역을 보여 준다.
   첫 K 테이블이 모두 캔버스 경계 안에 있고 전체 컬럼을 렌더했는지 검사한다.

K에 따라 뷰포트를 계산한다. 열 수는 `ceil(sqrt(K))`이며, 폭은 `max(1800, 열 수 × 900 + 400)`,
높이는 `max(1100, ceil(K / 열 수) × 740 + 200)` CSS px다. 실제 값은 JSON에 기록한다.
K가 다른 결과는 뷰포트 면적도 다르므로 함께 해석해야 한다.

생성한 fixture는 격리 테스트 DB에 남는다. 보고서의 `fixture.target`으로 식별할 수 있다.
기존 smoke의 fixture를 재사용하거나 삭제하지 않는다.

## 시나리오

### C1: 단일 작성자

클라이언트 0이 다음 작업을 각각 M회 한다.

- 첫 테이블의 첫 컬럼 물리명을 `c1_순번`으로 변경한다. 실제 textbox `fill`을 사용한다.
- 해당 테이블의 `컬럼 추가 / Add Column` 버튼을 누른다.
- 헤더의 컨트롤이 없는 왼쪽 위 padding을 드래그해 좌우 48 모델 px씩 번갈아 옮긴다(현재 확대율로 화면 좌표 변환).
  현재 확대율로 모델 좌표를 계산하고, 드래그 종료 `pointerup`을 기준 시각으로 삼는다.
- 사이드바의 `테이블 추가 / Add table` 버튼을 누른다.

이름 변경은 컬럼 ID와 새 이름, 컬럼 추가는 행 수, 이동은 모델 transform(허용 오차 2px),
테이블 추가는 사이드바 항목 수로 관찰한다. 각 편집 후 피어 반영을 기다리므로 C1은 순차 부하다.
추가한 컬럼과 테이블은 해당 시나리오 동안 남으며 N은 **시작 시점** 크기다.
`summary.byOperation`과 Markdown에 네 종류를 따로 집계한다.

### C2: 동시 작성자

작성자 i는 테이블 `t{i}`의 첫 컬럼을 `c2_작성자_슬롯`으로 바꾼다.
작성자마다 고정 간격을 예약한다. 피어 ACK를 기다리지 않고 다음 UI 입력을 진행하며,
뒤처진 슬롯은 건너뛰어 지연 뒤에 입력이 몰리지 않게 한다. 실제 달성 rate와 입력 수를 보고한다.
UI 입력 자체가 느리면 목표 rate보다 낮을 수 있다.

모든 편집의 감시 조건을 입력 전에 K개 페이지에 등록한다. 이미 반영된 조건은 감시 대상에서
빼서 누적 표본 수에 비례해 DOM 검사가 늘어나지 않게 한다. 부하 종료 뒤 결과를 일괄 수거한다.
한 페이지에서 여러 편집을 놓쳐도 전파 대기 제한을 편집 수만큼 반복하지 않는다.

### C3: 같은 대상 충돌

모든 페이지가 `t0`를 편집 모드로 준비한 뒤 Promise.all로 다음 동작을 발행한다.

1. 같은 컬럼 `t0c0`에 각자 `conflict_작성자` 값을 입력한다.
   모든 실제 input 이벤트가 기록되고, 최종 값이 제출값 중 하나이며, 모든 페이지에서
   300ms 이상 동일해야 `PASS`다. 기존 값이 그대로 남은 경우에는 통과시키지 않는다.
2. 같은 테이블에서 각자 `컬럼 추가`를 누른다. 기본 이름은 모두 `column`일 수 있지만
   앱이 생성한 컬럼 ID는 서로 다르다. 최종 ID 집합이 모든 페이지에서 같고,
   기존 ID를 모두 포함하며, 중복/빈 ID 없이 기존 수+K개여야 `PASS`다.

`convergence`에 `pass`, `status: PASS/FAIL`, 실제 입력 시각, 입력 시각 차이,
최종 값/컬럼 ID 집합, 수렴 시간을 기록한다. 각 검사는 별도로 결과를 남긴다.
동시 발행은 OS 차원의 동일 시각 실행을 보장하지 않는다. `dispatchSkewMs`를 반드시 확인한다.
동일 계정은 기존 앱의 사용자 단위 soft lock에서 제외되므로 여러 컨텍스트에서 같은 테이블을 편집할 수 있다.

### C4: 늦은 합류

각 N에 대해 새 컨텍스트를 UI 로그인시킨 뒤, 다이어그램 접속 직전부터
`waitForEditableDiagram`의 기준인 편집 가능 백업 버튼이 DOM에 나타날 때까지 측정한다.
로그인 시간은 제외한다. MutationObserver가 최초 준비 시각을 저장하므로 헬퍼의 1초 폴링 대기가
측정값에 그대로 더해지지 않는다. `t0` 컬럼 렌더도 추가로 확인한다.

유휴 합류 후 그 컨텍스트를 닫고, 또 다른 컨텍스트를 미리 로그인시킨다.
K명의 C2 편집 중 첫 입력이 완료되면 새 컨텍스트를 합류시킨다. 이때는 최대 K+1 컨텍스트가 있다.
편집 창이 이미 끝났다면 부하 중 합류로 통과시키지 않는다. 준비 완료가 부하 창 뒤로 넘어갈 수는
있으며, 합류가 길어져도 기존 작성자의 부하와 페이지 지표 창을 연장하지 않는다.

## 지표 정의와 단위

모든 UI 입력/관찰 시각은 각 페이지의 `performance.timeOrigin + performance.now()`이며 단위는 ms다.
같은 머신·Chromium의 시계를 공유한다는 전제다. 음수 피어 지연은 0으로 보정하지 않고 오류로 남긴다.

| JSON 필드                             | 의미                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `samples[].startedAt`                 | 작성자의 실제 input/click/pointerup 캡처 단계 시각                                     |
| `samples[].peers[].seenAt`            | 해당 DOM 조건이 처음 일치한 시각                                                       |
| `samples[].peers[].latencyMs`         | 피어 seenAt − 작성자 startedAt                                                         |
| `samples[].localMs`                   | 입력 → 작성자 자신의 DOM 조건 일치. 드래그는 종료 전에 로컬 이동하므로 null            |
| `localSource`, `peers[].source`       | `mutation` 또는 `raf`. 관찰 방법을 표본마다 기록                                       |
| `summary.peerMs`, `summary.localMs`   | 전체 표본의 n/p50/p95/max/mean. 피어 수만큼 표본 발생                                  |
| `summary.byOperation`                 | C1 작업 종류별 동일 통계                                                               |
| `missingPeerObservations`             | 누락된 피어 반영 수. 타임아웃은 0ms 표본으로 넣지 않음                                 |
| `load.attemptedEdits`, `load.edits`   | 준비한 편집 수 / 실제 입력 이벤트가 확인된 수                                          |
| `load.writers[].achievedRate`         | 실제 입력 수 / 실제 부하 창 길이(초)                                                   |
| `pages[].longtaskCount/TotalMs/MaxMs` | PerformanceObserver longtask 수/총 시간/최대 시간                                      |
| `pages[].frameGapOver50Count`         | 측정 창 중 rAF 간격이 50ms를 초과한 횟수                                               |
| `pages[].frameGapMaxMs`               | 가장 큰 rAF 간격                                                                       |
| `pages[].cdpDeltaMs`                  | CDP Performance의 TaskDuration/ScriptDuration/LayoutDuration 종료−시작. 초를 ms로 변환 |
| `pages[].websocket`                   | CDP WebSocket 송수신 프레임 수와 payload byte 합. 바이너리는 base64를 디코딩해 계산    |
| `pages[].jsHeapMiB`, `heapSamples`    | 편집 창 시작/종료 및 매 1초 CDP Runtime.getHeapUsage의 usedSize                        |
| `server.cpuPercent`                   | java PID의 ps %cpu 표본 평균/최대 및 백분위수                                          |
| `server.rssMiB`                       | ps rss(KiB)를 MiB로 변환한 평균/최대 및 백분위수                                       |
| `convergence[].convergenceMs`         | 첫 실제 입력 → 최종 안정 상태를 처음 확인한 시각. 추가 300ms 확인 대기는 제외          |
| `joins[].editableMs`                  | 다이어그램 접속 직전 → 편집 가능한 DOM의 최초 관찰 시각                                |

백분위수는 정렬한 유효 표본의 **최근접 순위법**이다. 빈 집합은 n=0과 null로 보고한다.
C2/C4의 페이지 지표는 로그인·초기 렌더·전파 결과 수거 시간을 제외한 편집 창을 대상으로 한다.
각 페이지의 CDP 호출 경계는 원자적으로 일치하지 않으며, DevTools/관찰기 자체 비용도 포함된다.
JS 힙은 JS 엔진 used heap이며 페이지 전체 RSS나 GC 전후의 정규화된 메모리가 아니다.
WebSocket payload byte는 프레임 헤더·TCP/TLS 오버헤드를 제외하며 awareness/heartbeat도 포함한다.

서버는 API 포트를 listen하는 PID를 `lsof`로 찾고 `ps comm`이 java인지 검증한다.
시나리오 준비 완료 후 시작/종료 및 매 1초에 `ps %cpu,rss`를 조회한다. 서버에 신호를 보내지 않는다.
`ps` CPU%의 정의는 OS에 따라 프로세스 수명 평균일 수 있으며 순간 구간 CPU와 같지 않다.
같은 서버의 다른 smoke 요청도 서버 표본에 섞인다. 조회 권한이 없으면 오류로 기록하고 UI 측정은 계속한다.

## 결과·오류·정리

`--out` JSON과 같은 이름의 `.md`에 요약 표를 쓴다. 환경에는 커밋, Node/Chromium 버전,
실행 파일, K/N/rate/duration, 뷰포트, 요청한 시나리오를 기록한다. 자격증명/토큰과 WS payload는 저장하지 않는다.
각 시나리오 종료 때 부분 결과를 저장하고, 전체 종료 때 `PASS` 또는 `FAIL`로 확정한다.
실패한 N/시나리오가 있어도 뒤의 조합을 계속 실행한다. 오류나 수렴 실패가 하나라도 있으면 종료 코드 1이다.
브라우저 실행 자체가 실패하면 `results`는 비고 `errors.phase=startup`에 차단 지점을 기록한다.

브라우저/컨텍스트는 finally에서 닫는다. SIGINT/SIGTERM도 브라우저를 닫아 진행 중 작업을 중단하고
보고서를 저장한다. SIGKILL이나 머신 종료 시에는 마지막 완료 시나리오의 부분 보고서까지만 남을 수 있다.
서버/watch 프로세스나 임시 로그 파일은 만들지 않는다. Playwright 임시 프로필 정리는 브라우저 종료 경로에 맡긴다.
longtask/WS는 원문 배열 대신 누적 수치를 저장하고, 힙은 최대 시간/편집 수 제한 안에서 수집하며,
페이지별 오류 원문은 50개로 제한한다. 오류 메시지도 길이를 제한한다.

## 검증 명령

```sh
node --check scripts/perf/erd-collab-bench.mjs
node --check scripts/perf/lib/erd-collab-probe.mjs
node --check scripts/perf/lib/erd-collab-system.mjs
node --check scripts/perf/lib/erd-collab-probe.test.mjs
node --check scripts/perf/eslint.collab.config.mjs
npx prettier --check scripts/perf/erd-collab-bench.mjs scripts/perf/lib/erd-collab-*.mjs scripts/perf/eslint.collab.config.mjs docs/erd-collab-perf.md package.json
npx eslint --config scripts/perf/eslint.collab.config.mjs scripts/perf/erd-collab-bench.mjs scripts/perf/lib/erd-collab-*.mjs --max-warnings=0
npm run lint:docs
node --test scripts/perf/lib/erd-collab-probe.test.mjs
```

기존 `eslint.config.js`는 TS/TSX 전용 규칙이 중심이므로 새 전용 설정에서 새 ESM에
recommended JS 규칙과 Node/browser globals를 적용한다. 기존 설정은 변경하지 않는다.
`lint:docs`의 `scripts/verify-function-docs.mjs`는 `client/src/` 아래 `.ts/.tsx`만 대상으로 하므로
이번 `.mjs`는 검사하지 않는다. 새 함수와 공개 상수에 JSDoc을 붙이고 별도로 구문·ESLint를 검증한다.

단위 테스트는 결정적인 DOM/Performance 계약 모형에서 컬럼 ID, 최초 MO 시각, input과 rAF의 시각,
이동 조건, longtask 측정 창, 누락 통계, 공유 TS 헬퍼 로드를 확인한다. 실제 React 렌더링과
서버 동기화 검증을 대체하지 않는다.

## 해석과 미확정 전제

- 같은 머신에서 K개 헤드리스 컨텍스트와 백엔드가 CPU를 공유한다.
  동일 장비·버전·뷰포트·K/N/rate/duration에서의 상대 비교에 사용한다.
- UI는 앱의 한국어/영어 role·aria-label을 대상으로 한다.
  React Flow class, `data-id`, `data-handleid`, `group/col` 행 구조와
  물리명 `span.font-mono.text-left`에 의존한다. UI 변경 시 셀렉터를 다시 확인해야 한다.
- 드래그는 헤더 왼쪽 위 padding, 48 모델 px 이동, 현재 앱의 16px snap grid를 전제로 한다.
  장식·여백·snap 설정이 바뀌면 실패할 수 있다. 예상 위치에 도달하지 못하면 타임아웃으로 기록한다.
- MutationObserver는 `input.value` property 대입을 알리지 않으므로 rAF로 보조 관찰한다.
  관측값은 DOM 도달 시간이며 실제 픽셀의 표시 완료 시간이 아니다. rAF 보조는 프레임 지연을 포함한다.
- C3 안정 상태는 25ms 간격의 DOM 읽기와 300ms 지속 일치로 판정한다.
  더 늦게 도착하는 갱신이나 네트워크 단절 후 재연결은 검사하지 않는다.
- C4는 각 N에서 idle/under-load를 한 번씩 측정한다. 합류 지연의 통계 분포가 필요하면 별도 실행을 반복한다.
- Vite의 초기 모듈 변환, React 개발 빌드, 다른 smoke, GC, OS 스케줄링과 관찰기 CPU 비용이 섞인다.
  대규모 측정은 다른 smoke 종료 후 실행한다.
