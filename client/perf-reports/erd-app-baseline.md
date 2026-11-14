# ERD 앱 코드 경로 벤치마크 baseline (erd-local)

- 생성: 2026-11-14, 하네스 `client/scripts/perf/erd-app-bench.mjs` (시드 생성기 `client/scripts/perf/lib/erd-app-seed.mjs`)
- 원본 데이터: `client/perf-reports/erd-app-baseline.json` (샘플 원시값, 렌더 카운트, probe 델타, CPU 프로파일 포함)
- 제품 코드(`client/src/**`)는 수정하지 않았다. 계측은 기존 인앱 probe + 페이지 주입 관찰자 + CDP 메트릭/CPU 프로파일이다.

## 1. 한 줄 요약

- 편집 1건의 비용이 테이블 수에 대해 **초선형**으로 늘어난다. 컬럼 이름 1글자: S200 0.33s, S500 1.1s, S1000 4.0s. 노드 드래그 1건과 엣지 추가/삭제 1건은 S200 0.2~1.3s, S500 14~17s, S1000 약 105~112s(드래그는 14~117s로 편차 큼).
- 데이터로 확인된 것은 H3(전 노드 재렌더/전 노드 updateNodeInternals)와 H8(뷰포트 밖 노드·엣지도 전부 DOM에 렌더)이다. H4는 erd-local 경로에서는 반증됐다. H1/H2는 단위 비용이 작고 전체 경로는 erd-local에서 측정할 수 없다.
- 새로 드러난 최대 핫스팟: S500 드래그/엣지 편집 때 메인 스레드 self-time의 51~58%가 `querySelector`이고, 호출자는 전부 `EdgeLabelRenderer`의 `useStore` 셀렉터(@xyflow/react)다. 원인 가설과 근거는 4절에 있다. 수정 효과는 제품 코드를 건드리지 못해 검증하지 않았다.

## 2. 측정 방법과 조건

| 항목 | 내용 |
|---|---|
| 라우트/서버 | `/erd-local`, `npm run local`과 같은 Vite dev(frontend-local 모드), `VITE_ERD_PERF_PROBE=true`. React 개발 빌드 + StrictMode이므로 절대값은 프로덕션보다 크다. |
| 시드 | S200/S500/S1000. 테이블당 컬럼 8~12개, 엣지 = 테이블의 1.2배(240/600/1200), 격자상 인접 테이블끼리만 연결, 노드 간격 640x560px(겹침 없음). 같은 크기는 항상 같은 그래프(seeded PRNG). |
| 브라우저 | headless Chrome for Testing 151.0.7922.34 (캐시된 chromium-1234를 executablePath로 지정. Playwright 1.58.2 기본 브라우저 revision 1208이 설치돼 있지 않았음), 뷰포트 1440x900 |
| 입력 | 실제 Playwright 키보드/마우스 입력. 대상 테이블은 fitView 후 뷰포트 중앙 노드를 휠로 확대해(폭 약 390px) 선택(편집 모드)한 것 |
| 반복 | 워밍업 + N회, p50/p95는 선형 보간. 반복 사이에 autosave 5초 tick이 끝나길 기다려 측정 창과 겹치지 않게 했다(`autosaveWrites`=0 확인). 유휴 기준선은 별도 측정. |
| 지표 | 입력→프레임: 입력 이벤트 `timeStamp`부터 다음 rAF 뒤 macrotask까지. settle: 입력부터 마지막 longtask 종료/DOM 변이까지(500ms 무활동 기준). longtask(>50ms) 수/합/최대, CDP `TaskDuration`/`ScriptDuration`/`LayoutDuration`/`RecalcStyleDuration`, 이벤트 타이밍, 인앱 probe 카운터 델타. React 렌더 횟수는 DevTools hook으로 별도 1회 패스에서 센다(PerformedWork 기준 컴포넌트 렌더 수). |
| probe 활성화 | `probeSetNavigationOrigin()`은 DiagramPage만 호출해 erd-local에서는 probe가 꺼진 채다. 하네스가 같은 모듈 인스턴스(`/src/lib/erd-performance-probe.ts`)를 동적 import해 호출한다. 앱 코드 카운터(`projection`, `table-node-mount` 등)가 증가하는 것으로 같은 인스턴스임을 확인했다. |

## 3. 결과

### 3-1. 시나리오 x 크기 (p50 / p95, ms)

입력→프레임 / settle(입력 후 작업이 끝날 때까지). longtask 합과 CDP task 시간은 JSON 참고.

| 시나리오 | n | S200 입력→프레임 | S200 settle | S500 입력→프레임 | S500 settle | S1000 입력→프레임 | S1000 settle |
|---|---|---|---|---|---|---|---|
| (a) 컬럼 이름 1글자 | 8 | 329 / 337 | 325 / 334 | 1,113 / 1,128 | 1,106 / 1,119 | 4,009 / 4,120 | 3,993 / 4,092 |
| (b) 컬럼 1개 추가 | 8 | 348 / 359 | 344 / 355 | 1,245 / 1,294 | 1,238 / 1,306 | 4,362 / 4,497 | 4,488 / 4,621 |
| (c) 노드 1개 드래그(약 60px, 10 move) | 8 / 2 / 2 | 137 / 150 | 1,259 / 1,270 | 593 / 594 | 17,394 / 17,444 | 2,060 / 2,089 | 65,861 / 112,291 |
| (d1) 엣지 추가(FK Connect) | 8 / 2 / 2 | 462 / 491 | 714 / 728 | 1,595 / 1,608 | 15,017 / 15,146 | 6,441 / 6,593 | 112,365 / 113,314 |
| (d2) 엣지 삭제(Keep FK) | 8 / 2 / 2 | 263 / 269 | 228 / 232 | 647 / 684 | 14,260 / 14,690 | 2,788 / 2,799 | 105,889 / 106,654 |
| 유휴 5.6초 창의 CDP task 합 | 5 | 157 / 223 | - | 234 / 349 | - | 255 / 510 | - |

- (a)(b)는 입력 핸들러 안에서 동기적으로 끝난다. 입력→프레임과 settle이 거의 같고 longtask는 2~3개다.
- (c)(d)는 입력→프레임이 상대적으로 작아도 뒤따르는 작업(longtask 85~180개)이 길게 이어진다. S500 c/d, S1000 c/d의 settle은 정착 대기 상한(S500 90s, S1000 240s)에 걸리지 않은 실측이다.
- S1000 드래그 2회의 settle은 117.5s와 14.3s였다(longtask 178개 vs 10개). 편차가 큰 이유는 규명하지 못했다. p50/p95 대신 두 값을 같이 읽어야 한다.
- S1000 (c)(d)는 워밍업 없이 n=2, S500 (c)(d)는 워밍업 1 + n=2다. p95는 사실상 최대값이다.
- 로드: 노드/엣지가 모두 DOM에 올라오기까지 S200 1.0s, S500 2.1s, S1000 5.4s. 이후 정착까지 longtask 합은 S200 1.6s(3개), S500 18.6s(87개), S1000 122.4s(170개, 최대 15.7s).

### 3-2. 편집 1건당 렌더/내부 갱신 횟수 (렌더 카운트 전용 패스 1회)

| 시나리오 | 크기 | 커밋 수 | TableNode 렌더 | ErdRelationEdge 렌더 | node-internals-queued(probe) |
|---|---|---|---|---|---|
| (a) 이름 1글자 | S200/S500/S1000 | 4 / 4 / 4 | 2.0xN (401/1001/2001) | 4.0xE | 0 |
| (b) 컬럼 추가 | 동일 | 6 / 6 / 6 | 2.0xN | 4.0xE | 1 |
| (c) 드래그 | 동일 | 218 / 518 / 16 | 8.0xN / 8.0xN / 7.0xN | 18xE / 18xE / 16xE | N (200/500/1000) |
| (d1) 엣지 추가 | 동일 | 210 / 513 / 1084 | 2.0xN | 4.0xE | N+2 (202/502/1001) |
| (d2) 엣지 삭제 | 동일 | 270 / 502 / 1068 | 1.0xN | 2.0xE | N |

N=테이블 수, E=엣지 수. TableNode 마운트는 (d1)에서 1개(자식 테이블 재마운트) 외에 0.

### 3-3. 인앱 probe와 CPU 프로파일 (비용 분해)

| 항목 | S200 | S500 | S1000 |
|---|---|---|---|
| (a) `detour-routing` 합(ms) / 호출 | 32 / 950 | 287 / 2,394 | 1,571 / 4,796 |
| (c) `obstacle-selector` 호출 수 / 합(ms) | 63,600 / 166 | 339,000 / 2,391 | 673,800 / 12,194 |
| (d1) `obstacle-selector` 호출 수 / 합(ms) | 52,048 / 136 | 310,108 / 2,139 | 1,306,584 / 25,300 |
| `projection` 합(ms), 편집 1건 | 0.2~0.9 | 0.5~2.1 | 1.0~6.3 |
| (c) 드래그 후 대상 노드의 store 배열 인덱스 | 112 -> 112 | 264 -> 264 | 527 -> 527 |

CDP CPU 프로파일(self-time, 1회씩, `cpuProfiles` 참고):

| 시나리오 | S200 `querySelector` 비중 | S500 `querySelector` 비중 | S500에서 `ErdRelationEdge.tsx` + `edgeAutoRoute.ts` 합 |
|---|---|---|---|
| (a) 이름 1글자 | 3.0% | 12.7% | 17.8% (edgeAutoRoute 13.8 + ErdRelationEdge 4.0) |
| (c) 드래그 | 28.5% | 50.8% | 16.9% |
| (d1) 엣지 추가 | 29.7% | 53.5% | 14.5% |
| (d2) 엣지 삭제 | 42.0% | 57.5% | 13.2% |

호출자 집계(S200 프로파일): `querySelector` 자기 시간의 98~100%가 `selector$6 @ @xyflow/react (deps/@xyflow_react.js:9021)`이다. 그 코드는 `EdgeLabelRenderer`의 `useStore` 셀렉터로, 내용은 `s.domNode?.querySelector(".react-flow__edgelabel-renderer")`다.

## 4. 가설 판정 (증거와 추정을 구분)

| 가설 | 판정 | 증거 | 아직 추정인 부분 |
|---|---|---|---|
| H1 문서 변경마다 Y.Doc 전체 인코딩/새 Y.Doc apply/전체 직렬화 | 전체 경로는 측정 불가. 단위 비용은 작음 | erd-local에는 persistence coordinator가 없다. 대신 같은 함수(`YjsSharedDocumentEngine.exportSnapshot` + `ErdCompatibilityArtifactSerializer.build`)를 라이브 Y.Doc에 7회 호출: 합 p50 S200 8.4ms, S500 21.1ms, S1000 45.5ms (스냅샷 1.57MB, artifact 1.19MB). 같은 크기의 편집 비용(a: 4.0s)의 약 1% | 350ms 디바운스 + requestIdleCallback 실행 빈도, 협업 모드의 체크포인트 복제/전송 비용은 미측정 |
| H2 문서 revision마다 전체 구조 읽기/정렬/JSON 해시 | 전체 경로는 측정 불가. 해시 단위 비용은 작음 | `buildRevisionHash`만 호출: p50 S200 2.4ms, S500 5.9ms, S1000 12.5ms. 이 훅은 `useDocumentReadExecutor()`가 필요한데 erd-local에서는 null이라 구조 읽기 자체가 실행되지 않는다(읽기 비용 제외한 하한) | `readErdDocumentStructure` 포함 전체 비용, 코드 패널이 열렸을 때 revision마다 호출되는 빈도 |
| H3 엣지 변경 시 모든 TableNode 재렌더링 + 모든 노드 updateNodeInternals | 확인됨. 단 "엣지 변경 시에만"이 아니라 모든 편집에서 발생 | (i) 이름 1글자에도 TableNode 2.0xN, 엣지 4.0xE 렌더. (ii) 드래그/엣지 추가/삭제 1건당 `node-internals-queued`가 N(N+2)건. (iii) 드래그 1건에 TableNode 8xN, 엣지 18xE 렌더. 엣지 추가(d1)의 TableNode 렌더(2.0xN)는 엣지를 안 건드린 (a)와 같아, `ConnectedColumnIdsContext`가 추가로 만드는 재렌더는 이 데이터로 분리되지 않는다 | 재렌더를 일으키는 직접 원인(컨텍스트 value, ReactFlow nodes 배열 교체 등)은 미규명 |
| H4 부분 갱신 투영이 O(N), 노드 순서 변경 | erd-local 경로에서는 반증 | `canvasSyncActions`의 `projection`은 S1000에서도 편집당 1.0~6.3ms. 드래그 후 노드 인덱스 불변 | H4가 가리킨 `use-diagram-page-runtime-state.ts`, `PreviewCanvas.tsx`(협업 DiagramPage 경로)는 erd-local에서 실행되지 않아 미측정 |
| H8 뷰포트 밖 노드 렌더링 생략 없음 | 현황 확인됨(효과는 미측정) | S1000에서 DOM의 노드 1000개/엣지 1200개 중 뷰포트에 걸치는 것은 16/22개(1.6%/1.8%), 전체 DOM 요소 138,933개. 로드 후 longtask 합 122s | `onlyRenderVisibleElements` 적용 시 개선폭(코드 수정 금지라 미실험). 비용이 엣지 수와 DOM 크기에 비례하는 구조라 효과가 클 것이라는 추정 |
| (신규) H9: 엣지마다 `EdgeLabelRenderer`가 스토어 변경 때마다 `querySelector`를 실행 | 증거 강함, 인과는 미검증 | S500 드래그/엣지 편집 CPU의 51~58%가 `querySelector`, 호출자 98~100%가 `EdgeLabelRenderer` 셀렉터. S500 DOM 69,041요소. 드래그 1건의 `EdgeLabelRenderer` 렌더 4,320회(S200) | `ErdRelationEdge`가 엣지마다 `EdgeLabelRenderer`를 렌더하므로 스토어 갱신 1회당 E번 DOM 탐색이 일어난다는 설명은 코드 읽기에 기반한 가설. 한 번만 렌더하거나 요소를 캐시하면 줄어드는지는 미검증 |
| (신규) H10: 엣지의 `obstacleRects` `useStore` 셀렉터가 스토어 변경마다 모든 노드를 순회 | 증거 있음(부분) | `obstacle-selector` 호출 수 드래그 1건당 S200 63.6k, S500 339k, S1000 674k. 엣지 추가 1건에 S1000 1.31M회, probe 합 25.3s. 프로파일상 `ErdRelationEdge.tsx:284/291/292` + `edgeAutoRoute.ts` 합 13~18% | probe는 셀렉터 구간만 잰다. 전체 영향은 프로파일의 비중(약 13~18%) 쪽이 더 믿을 만하다 |

우선순위 근거(데이터만): 이 baseline에서는 H9와 H3(전 노드 재렌더/내부 갱신)가 같은 줄기(스토어 한 번 바뀔 때마다 모든 엣지·노드가 일하는 구조)이고 비용 대부분을 차지한다. H10이 그다음이다. H8은 위 둘의 비용 상수를 줄일 수 있는 후보다. H1/H2는 단위 비용이 편집 비용의 1% 안팎이라 이 데이터로는 후순위다. 다만 협업 모드 전체 경로 비용은 아직 모른다.

## 5. erd-local에서 측정할 수 없었던 항목과 이유

| 항목 | 이유 |
|---|---|
| (e) 코드 탭에서 한 글자 입력(코드 모드 경로) | (1) `useDocumentReadExecutor()`가 null이라 ERD->코드 방향 구조 읽기가 비어 있다. 코드 패널이 비어 시작하고, 작은 DDL 한 줄을 입력하면 ERD 전체가 그 DDL로 교체됐다(50개 테이블 -> 1개). 증분 diff 적용 경로가 아니라서 대표성이 없다. (2) 생성한 DDL(S20, 약 10KB)을 Monaco에 한 번에 붙여넣자 두 번 모두 페이지가 응답하지 않았고, 두 번째 시도에서 `Target crashed`(렌더러 종료)를 확인했다. S100 DDL은 4분 이상 멈췄다. 원인은 규명하지 못했고, 하네스 문제인지 앱 문제인지 구분하지 못했다. 앱 문제라면 별도 조사가 필요하다. |
| H1/H2 전체 경로 | 협업 런타임(문서 세션, persistence coordinator, read executor)이 erd-local에 없다. 단위 함수 비용만 측정했다. |
| WebSocket/협업 비용 | 원격 업데이트 적용(`ydoc-apply`, `snapshot-merge`), awareness/커서, 서버 스냅샷 flush, ws-frame 크기. 백엔드를 띄우지 않는 제약이고 erd-local은 WS를 쓰지 않는다. |
| DiagramPage 전용 probe 지표 | `preview-*`, `live-ready`, `live-settled`, `diagram-page-commit` 등은 DiagramPage에서만 발생한다. 이 하네스는 navigation origin만 직접 설정한다. |
| 프로덕션 빌드 수치 | dev 서버(React 개발 빌드, StrictMode)만 측정했다. 상대 비교/스케일링은 유효하지만 절대 ms는 과대하다. |
| H8 개선 효과 | 제품 코드 수정 금지라 `onlyRenderVisibleElements` 전후 비교를 못 했다. |

## 6. 한계와 주의

- 표본이 작다: S200 (a)(b)(c)(d)와 S500 (a)(b)는 n=8, S500 (c)(d)는 n=2(워밍업 1), S1000 (c)(d)는 n=2(워밍업 없음). S1000 드래그는 두 표본이 117s/14s로 크게 다르다.
- 실행이 여러 번으로 나뉘어 있다: 첫 전체 실행의 S500 (c)는 정착 대기 상한(12s)에 걸려 하한값이었고, S500 (d)와 S1000 (c)(d)는 시나리오 타임아웃/클릭 타임아웃으로 실패했다. 이후 상한을 늘린 재실행 결과로 대체했다(JSON `meta.runs` 참고, 대체 전 값은 `supersededMainRun`).
- (d)의 엣지 선택은 대부분 실제 마우스 클릭이다. S200 반복 1회는 가려진 엣지 때문에 같은 React 핸들러를 타는 합성 click 이벤트로 대체했다. 엣지 삭제는 키 입력(Delete) 후 다이얼로그의 Keep FK 클릭이다. 엣지 추가는 FK Connect 모드(부모 -> 자식 클릭 -> Non-identifying)라 자식 테이블에 FK 컬럼이 같이 생긴다. 반복마다 컬럼이 조금 늘어난다.
- (b)는 추가한 컬럼을 측정 창 밖에서 지워 노드 크기를 유지했다.
- 렌더 카운트는 반복당이 아니라 전용 패스 1회 값이다. 커밋 수는 메인 스레드가 막힌 정도에 따라 달라진다(예: S1000 드래그 패스는 16커밋, S200은 218).
- longtask(>50ms) 관찰만으로는 짧은 작업을 놓치므로 CDP `TaskDuration` 델타를 같이 기록했다. 측정 창의 task 합은 유휴 기준선(5.6초에 약 160~255ms)을 포함한다.
- CPU 프로파일은 시나리오당 1회, S500은 호출자 집계 도입 전에 찍어 호출자 정보가 없다(호출자 집계는 S200 프로파일 기준). S500 비중은 같은 프로파일의 self-time 기준이다.

## 7. 재현

```bash
cd client
npm run perf:erd:app                                           # S200,S500,S1000 x 10회 (오래 걸림, S500/S1000의 c/d는 수십 분 단위)
npm run perf:erd:app -- --scenarios S200 --iterations 3 --out /tmp/erd-app-s200.json   # 빠른 확인
# 정착 대기 상한을 늘려 큰 시드의 드래그/엣지 편집을 측정
node scripts/perf/erd-app-bench.mjs --scenarios S500 --only c,d --iterations 2 --warmup 1 --settle-max-s 90 --scenario-timeout-s 1800 --out /tmp/erd-app-s500.json
# 시나리오별 CPU 프로파일 패스 추가
node scripts/perf/erd-app-bench.mjs --scenarios S200 --only a,c,d --iterations 1 --warmup 1 --profile --out /tmp/erd-app-prof.json
```

Vite는 하네스가 직접 띄우고(기본 포트 4501, 사용 중이면 4511부터 빈 포트) 크기 제한이 있는 임시 로그(2MB)에만 기록하며, 종료 시 프로세스 그룹을 종료하고 임시 로그 디렉터리를 지운다. 백엔드/DB는 띄우지 않는다.
