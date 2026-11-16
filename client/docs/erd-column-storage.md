# S2 컬럼 저장 모델과 호환성

컬럼 본체는 `table.columnsById: Y.Map<columnId, Y.Map<fields>>`, 순서는
`table.columnOrder: Y.Array<string>`에 저장한다. 이동은 문자열 ID만 삭제/삽입하며
본체 Map은 교체하거나 detach하지 않는다. 같은 필드의 미관측 동시 편집은 Yjs의
결정적 승자로 수렴한다(D3-b). 로컬 우선 승자를 보장하지 않는다.

읽기는 새 본체 Map이 있으면 새 스키마를 사용한다. 순서의 중복은 첫 항목만 유지하고,
본체 없는 ID는 무시하며, 순서에 없는 본체는 ID의 코드 단위 정렬 순서로 뒤에 붙인다.
읽기는 문서를 변경하지 않는다. add/move 쓰기 전에는 이 표시 순서를 ID 배열에도
정규화하므로 손상되거나 동시 편집된 순서에서도 표시 인덱스로 이동할 수 있다.

## 추가 스키마와 롤백

기존 `columns: Y.Array<Y.Map>`은 삭제하거나 갱신하지 않는다. S2-B 이후 신규 테이블과
JSON bootstrap/재시딩은 **새 구조만 직접 생성**하고 레거시 배열을 만들지 않는다.
S2-A에서 이미 만든 독립 레거시 복사본은 남아 있을 수 있다. 레거시를 미러링하면
삭제/복제로 인한 편집 소실과 이중 쓰기가 다시 생기므로 미러링하지 않는다.
**구버전 클라이언트는 레거시 배열이 남은 테이블에서 이관 전의 오래된 컬럼만 읽고,
새 구조만 있는 테이블에서는 빈 컬럼 목록을 읽는다.** flag rollback은 추가 스키마를
제거하거나 구버전 읽기/쓰기를 복구하지 않는다. 현재 구현은 flag와 무관하게 첫 컬럼
변경 시 이관하므로 flag-off를 안전한 구버전 호환 모드로 간주해서는 안 된다.

S5 서버 프로토콜 버전 게이트에서 구버전 쓰기를 차단해야 한다(D4-a).
설계 개정 2에 따라 게이트는 **새 구조가 비-internal 다이어그램에 쓰이기 전**에 필요하다.
현재 로컬 feature 브랜치는 게이트 구현 전 배포/푸시 금지다. 이 단계는 서버나 기능 flag를
변경하지 않는다. 서로 다른 레거시 스냅샷을 가진 구버전 클라이언트의 동시 쓰기/이관은
지원하지 않는다.

### 다운그레이드·혼합 버전 행렬

아래의 구버전은 `columns` 배열만 사용하는 S2-A 이전 클라이언트다. 같은 바이너리에서
UI flag만 끄는 것과 구버전 바이너리로 돌아가는 것은 별개다.

| 테이블 상태                                     | 구버전 읽기                                                   | 구버전 쓰기와 신버전 관측                                                                                                                                          | 지원 여부                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 레거시만 있음, 아직 이관 전                     | 현재 `columns` 배열                                           | 구버전은 배열을 편집한다. 신버전도 이관 전에는 배열을 읽는다                                                                                                       | 동일 레거시 상태만 지원. 이관과 미관측 구버전 쓰기의 경쟁은 지원하지 않음 |
| 레거시에서 이관됨, 이전 배열 남음               | 이관 시점 배열. 신버전 추가/삭제/이동/필드 변경은 보이지 않음 | 구버전 필드/추가/삭제/이동은 이전 배열에만 반영된다. 신버전은 `columnsById`를 우선하므로 이 편집을 반영하지 않는다. 바이너리 동기화 완료와 사용자 편집 보존은 다름 | 혼합 쓰기 차단 필수                                                       |
| S2-A가 만든 두 구조가 있는 신규 테이블          | 최초 생성 시점 레거시 복사본                                  | 위와 같은 분리된 쓰기. 레거시는 최신 상태의 mirror가 아님                                                                                                          | 혼합 쓰기 차단 필수                                                       |
| S2-B 신규/JSON 재시딩, 새 구조만 있음           | `columns`가 없어 빈 컬럼 목록                                 | 배열 존재를 요구하는 구버전 편집은 적용되지 않는다. 구버전이 배열을 새로 만들어도 신버전 읽기는 이를 무시한다                                                      | 구버전 편집 및 이를 바탕으로 한 백업/저장 차단 필수                       |
| 동일한 레거시 snapshot에서 시작한 신버전 피어들 | 공통 reader가 새 구조 우선, 없으면 레거시 fallback            | 결정적 seed로 동시 최초 이관과 이후 필드/순서 변경이 수렴                                                                                                          | 실제 Yjs 테스트로 지원 검증                                               |

S5 게이트는 다이어그램 단위 편집 프로토콜 버전을 서버에서 검증해야 한다. 구버전 또는
버전을 보내지 않는 세션의 실시간 update/쓰기용 sync 응답, 오프라인 누적 update 재전송,
compacted/full-state snapshot 교체·최초 seed, REST content/백업의 authoritative 저장을
포함해 문서를 바꿀 수 있는 진입점을 차단해야 한다. 이미 연결된 구버전 세션도 버전 전환
전에 쓰기가 중단되어야 한다. presence 버전이나 snapshot 전송 포맷 v1/v2는 컬럼 편집
프로토콜 버전의 대체 수단이 아니다. 읽기 전용 구버전을 허용해도 최신 컬럼을 보여준다는
보장은 없으며, 오래되거나 빈 투영을 authoritative content로 저장하게 해서는 안 된다.
게이트 구현과 배포 검증은 S2-B 범위 밖이다.

## JSON 백업·재시딩 계약

REST/백업/정의서 입력은 계속 `nodes[].data.columns: Column[]` plain 배열이다.
`columnsById`/`columnOrder`는 Y.Doc 내부에만 있으며 JSON에는 노출하지 않는다.
`yDocToJson`은 이관 전후 동일한 컬럼 순서와 필드를 내보낸다. JSON 재시딩은
`migrateJsonToYDoc`와 `DiagramYjsDocumentAdapter.applyBootstrapToDoc`가 공통
`createTableYMap`을 거쳐 새 저장소를 직접 만든다. `createColumnYMap`과 이 생성기는
선택 필드 생략과 명시적인 `false`/빈 문자열/숫자 `0`을 구분해 보존한다. 누락된 선택
필드에 임의 기본값을 넣지 않는다. 기존 테이블 색상 등 메타데이터의 정규화는 유지한다.
이전 버전에서 저장한 plain 배열 JSON도 입력으로 허용한다.

재시딩은 새 Y.Doc/새 타입 ID를 만든다. 기존 협업 문서의 update를 이어 붙이는
컴팩션과 달리, 이전 문서의 오프라인 update/undo 이력을 이어 붙이는 용도가 아니다.
컴팩션은 기존 Y.Doc의 `Y.encodeStateAsUpdate`로 수행해야 한다.

서버에 Y.Doc snapshot이 있는 preview 경로는 bootstrap `content`를 live Y.Doc에
재시딩하지 않는다. 연결 후 grace/전체 대기 시간이 지나면 `fallback-timeout`으로
degraded 상태만 알리고 읽기 전용 preview와 observer를 유지한다. 늦게 도착한 원격
테이블은 `remote-snapshot-applied`로 preview를 해제하고 live 상태로 복구한다.
snapshot이 없는 content-only 최초 시딩 경로는 별도 계약을 유지한다.

## 지연 이관과 undo

읽기만 할 때는 이관하지 않는다. 최초 컬럼 쓰기 직전, 기존 시스템 정규화 origin인
`CANVAS_HISTORY_ORIGIN.SYSTEM_FALLBACK` 트랜잭션으로 테이블 하나를 이관한다.
사용자 mutation은 이어지는 원래 origin의 트랜잭션에 적용한다. 두 트랜잭션은 같은 동기
호출에서 실행한다. 이관을 사용자 트랜잭션에 중첩하면 Yjs가 외부 origin을 사용해 undo가
스키마까지 제거할 수 있으므로, 이관과 사용자 undo 경계를 분리했다.

단순히 각 피어가 새 nested Map을 만들면 **동시 최초 이관끼리도 Map 교체 충돌**이 난다.
이를 막기 위해 대상 테이블의 컬럼 구조만 담은 독립 최소 Y.Doc에서 동일 레거시 타입
ID/정렬된 필드 스냅샷으로 동일한 Yjs seed update를 생성한다. 전체 문서는 복제하거나
인코딩하지 않는다. 테이블의 활성 소속은 ID 키로 직접 확인하며 테이블 목록을 순회하지
않는다. seed client ID는 FNV-1a 기반 52-bit 해시에 상위 비트를 켠
안전 정수이며 일반 Yjs random uint32 client ID 공간과 분리한다. 실제 피어의 client ID는
바꾸지 않는다. clock 0과 기존 필드/컬럼 쓰기 순서를 유지한 뒤 두 최상위 schema Item의
parent만 실제 테이블의 Yjs Item ID로 지정한다. 이는 Yjs Item 인코더의 ID 참조 경로를
사용하며 하위 컬럼은 seed 내부 부모 ID를 그대로 유지한다. 임시 문서는 즉시 destroy한다.
이관 후에는 기존 본체를 재초기화하지 않는다. 사전 일괄 반영은 대상 테이블 ID를 중복
제거하고, diff 준비도 대상 Set을 사용한다. 이미 이관된 테이블은 저장된 schema를 보고
즉시 건너뛰며 캐시는 사용하지 않는다. seed 생성 비용은 대상 컬럼의 필드 수에 비례한다.

이 결정적 seed 알고리즘과 필드 정렬은 프로토콜 계약이다. 같은 버전에서 임의로 바꾸면
피어별로 다른 본체가 생성될 수 있다. seed 해시에는 이론적인 충돌 가능성이 있으며,
구버전 쓰기 차단 및 이 알고리즘에 대한 독립 검토가 배포 전 필요하다. Yjs 내부 Item
표현에 의존하므로 Yjs 업그레이드 때 최소 seed와 동시 최초 이관 테스트를 다시 확인한다.
기존 schema 키에 잘못된 값이나 삭제 이력이 있으면 clock 0을 재사용하지 않고
`ERR_COLUMN_STORAGE_INCONSISTENT`로 거부한다. 손상된 schema의 복구는 별도 정책이 필요하다.
계산한 seed clientID가 문서에 이미 있어도 같은 코드로 거부한다. 예를 들어 레거시 배열이
없는 빈 테이블을 이관·삭제하고 같은 테이블 ID로 다시 만든 경우, 이전 clock에 의해
최소 update가 무시되며 저장소가 생성되지 않는 상황을 방지한다.

`ensureColumnStorage`는 미이관 테이블에서 `doc._transaction`이 열려 있으면 문서를
변경하기 전에 영문 메시지와 `code: 'ERR_COLUMN_MIGRATION_IN_TRANSACTION'`인 Error를
던진다. 시스템 origin을 지정하더라도 중첩 transaction은 허용하지 않는다. 호출자는 반드시
transaction을 열기 전에 이관을 준비해야 한다. 이미 이관된 테이블의 필드/순서 쓰기는
사용자 transaction 안에서 정상 동작한다.

## 필드 patch와 삭제

플러그인, 캔버스 fallback, 사전 반영, DDL, diff, JSON bootstrap과 신규 테이블 생성은
공통 저장 경로를 사용한다. 테이블 복사본을 JSON에서 복원하는 경우도 같은 생성기를 거친다.
기존 `yjsBridge` export의 인자 형태는 유지한다. 배열 인자를 받는 이동/삭제 helper도
테이블에 attach된 배열이면 새 스키마로 전달한다. `deleteColumnFromYArray`와
`moveColumnInYArray`는 deprecated이며 앱 내부에서 호출하지 않는다(`client/src` 검색으로
정의 외 호출 없음 확인). 호환 호출에도 위 가드가 적용된다. 미이관 상태에서 열린
transaction으로 호출하면 명시 거부하며, 레거시 배열에 우회 쓰기를 하지 않는다.

업데이트는 트랜잭션 안에서 본체 존재를 확인하고 변경 필드만 set/delete한다. diff는
base→local에서 변경한 필드만 고른 후 현재 Y.Doc과도 비교해 이미 같은 값은 쓰지 않는다.
따라서 사용자가 바꾸지 않은 필드의 원격 편집을 덮어쓰지 않는다.

삭제는 본체 엔트리와 관측한 순서의 모든 동일 ID를 제거한다. 동시 편집은 본체 삭제와 함께
사라지고, 늦게 도착한 편집은 조용히 무시한다. 동시 이동이 남긴 순서 ID도 본체가 없으므로
읽기에서 제외한다(D3-c). 사용자 재생성은 새 ID를 사용한다. 명시적인 undo/redo 복원은
Yjs UndoManager의 기존 동작을 따른다.

## 검증 범위

`test/unit/yjs-column-compatibility.test.ts`는 수작업 레거시 Y.Doc/이전 버전 JSON
fixture와 실제 `Y.encodeStateAsUpdate`/`Y.applyUpdate`를 사용한다. 레거시 full-state
snapshot → 첫 mutation 이관 → incremental update 목록을 순서/역순/중복 전달해 JSON
일치를 확인한다. GC true/false 원본과 복구 문서를 교차해 필드 덮어쓰기·삭제·이동 후
컴팩션/재컴팩션/재편집을 검증한다. 같은 레거시 테이블에 대한 오프라인 이관/온라인
필드 편집의 재접속과 3자 동시 이관/필드 편집은 기대 컬럼 전체와 순서를 단언한다.
이 테스트의 온라인 피어도 신버전이다. 구버전 쓰기와의 병합을 지원한다는 뜻이 아니다.

JSON fixture는 선택 필드가 없는 컬럼과 명시적인 false 값이 있는 컬럼을 포함한다.
레거시/이관 문서의 백업과 bootstrap adapter/artifact 재시딩, 새 구조만 생성하는 계약을
검증한다. 새 구조만 있는 문서에서 원격 update의 `observeDeep` → scope 알림 →
read-context 조회와 순서, graph query → DSL/DDL/정의서 JSON 입력도 검증한다.
혼합 버전 fixture는 남은 레거시 배열의 오래된 읽기와 구버전 쓰기가 새 본체에 반영되지
않음을 의도적으로 확인한다.

`test/unit/yjs-column-concurrency.test.ts`는 실제 Y.Doc 간 update 교환으로 이동/편집,
동시 이동, 삭제/편집, 동시 최초 이관, 중복/누락 순서, 직렬화 왕복, 필드 patch,
undo, 조회와 scope 알림, 캔버스 fallback을 검증한다. 관련 없는 문서 변경이 있어도 독립
최소 seed update 바이트가 동일하며, 호환 헬퍼의 중첩 최초 이관 거부 후 원격 컬럼 편집과
schema가 undo 이후 양 피어에 보존됨을 검증한다. 기존 diff 테스트의 단언은 유지하고
테스트 조회 helper만 공통 읽기 경로로 바꾼다.

`test/unit/yjs-column-migration-performance.test.ts`는 실제 Yjs로 200테이블 × 20컬럼
`dictionary:reconcile`을 1초 미만, 500테이블 × 20컬럼 일괄 이관을 5초 미만으로 검증한다.
시간과 함께 원본 문서 struct 인코딩 0회, 테이블별 이관 1회, 반복 시 추가 이관 0회를
단언한다. 계측은 인코더 인자를 보관하지 않으며, 성능 기준은 fixture 생성 시간을 제외한다.

브라우저/e2e, 서버 프로토콜 게이트, 서로 다른 레거시 버전의 혼합 쓰기는 이 단계에서
검증하지 않았다. 원격 FK 생성과 삭제의 병합 후 전체 참조 검증 및
충돌 알림 UI는 후속 통합/다중 클라이언트 검증 범위다.

## S2-B reader 감사 (2026-11-16)

`client/src` 전체에서 `get('columns')`/쌍따옴표 변형, `getColumns`, `getMap('tables')`,
`columnsById`/`columnOrder`, `toJSON`, 관찰자와 공통 투영 함수 사용처를 검색했다.
직접 레거시 키 읽기는 아래 첫 두 곳뿐이며, 이관 후 빈 컬럼을 반환하는 추가 reader는
찾지 못했다. 레거시 복사본을 함께 생성하던 bootstrap 경로와 선택 필드의 truthy 기반
생략은 수정했다. 기존 read-context 수정은 S2-A에 이미 포함돼 있어 추가 변경하지 않았다.

| 경로 (모두 `client/src/` 기준)                                                                                                                             | 확인한 읽기/알림 경로와 결과                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collaboration/yjs-columns.ts:18`                                                                                                                          | `readColumnYMaps`: 새 Map이 없을 때만 레거시 fallback. 새 구조만 있어도 읽음                                                                                   |
| `collaboration/yjs-columns.ts:128`                                                                                                                         | `ensureColumnStorage`: 최초 이관 seed의 레거시 타입 ID 입력. 이관 후에는 진입하지 않음                                                                         |
| `collaboration/yjs-columns.ts:42`                                                                                                                          | `getColumnYMap`: 새 Map에서 ID 조회, 미이관이면 공통 reader 사용                                                                                               |
| `collaboration/yjsBridge.ts`                                                                                                                               | 단일/전체 노드 투영과 `yDocToJson`은 `readColumnYMaps` 사용. JSON은 plain 배열 유지. `createTableYMap`은 새 구조만 생성하도록 수정                             |
| `collaboration/plugins/erd/query/erd-document-read-context-factory.ts`                                                                                     | `listRelated`/`findByKind`는 공통 reader, `readColumnEntity`는 ID reader 사용. 새 구조만 있는 원격 update로 회귀 검증                                          |
| `collaboration/plugins/erd/query/erd-document-graph-query.ts`                                                                                              | `listRelated`/`getEntity`로 컬럼 투영. `channel/diagram/use-diagram-erd-read-snapshot.ts`와 DSL/DDL 편집 패널의 입력. 새 구조 fixture → 실제 DSL/DDL 생성 검증 |
| `collaboration/plugins/erd/erd-document-mutation-applier.ts`                                                                                               | 필드/FK/DDL/사전 읽기에 `getColumnYMap`/`readColumnYMaps` 사용                                                                                                 |
| `lib/erd-diff-apply.ts`                                                                                                                                    | diff/FK 정리 읽기에 같은 공통 함수 사용                                                                                                                        |
| `lib/erd-yjs-utils.ts`, `lib/erd-ddl-yjs-utils.ts`, `stores/canvas/canvasStoreHelpers.ts`                                                                  | `findColumnYMap` 호환 export/re-export. attach된 레거시 배열이면 부모 테이블의 새 저장소를 우선 읽음. 현재 앱 내부 호출은 없음                                 |
| `stores/canvas/canvasTableActions.ts`                                                                                                                      | 필드/FK/사전 읽기는 ID reader 사용                                                                                                                             |
| `stores/canvas/canvasSyncActions.ts`                                                                                                                       | 최초 로드/복구/serialize는 공통 투영. `tablesMap.observeDeep`의 중첩 path에서 table ID를 구하고 단일 노드 투영. 신형 본체/순서도 관찰 범위에 포함              |
| `collaboration/plugins/erd/erd-yjs-update-scope-collector.ts`                                                                                              | 레거시 배열, `columnsById` 본체 필드, 본체 Map/`columnOrder` 변경을 테이블 scope로 수집. 신형 필드 변경은 컬럼 scope도 수집                                    |
| `collaboration/channel/diagram/diagram-preview-hydration-controller.ts`                                                                                    | `observeDeep`/원격 테이블 수로 unlock 판단. timeout은 degraded만 알리고 preview/observer를 유지하며 live Y.Doc에 bootstrap을 쓰지 않음                         |
| `collaboration/core/engines/yjs-shared-document-engine.ts`, `core/store/document-revision-tracker.ts`                                                      | 문서 update/revision 전달. 컬럼 스키마를 필터링하지 않음                                                                                                       |
| `collaboration/YjsProvider.ts`, `types/collaboration.ts`                                                                                                   | awareness/presence는 사용자·커서·선택/편집 ID·락·edge preview. 컬럼 본체 snapshot을 읽거나 운반하지 않음                                                       |
| `collaboration/plugins/markdown/**`, `collaboration/plugins/screen-spec/**`                                                                                | 각 문서의 전용 reader/projector. ERD tables/columns 읽기 없음                                                                                                  |
| `components/erd/TableNode.tsx`, `hooks/useExportDiagram.ts`, `lib/export/export-executors.ts`                                                              | 화면은 투영된 `data.columns`, PNG/PDF는 그 DOM을 캡처. Y.Map 직접 접근 없음. 실제 캡처/렌더는 미실행                                                           |
| `components/erd/DdlExportDialog.tsx`, `lib/ddl-generator.ts`                                                                                               | store의 투영 노드 → SQL 생성. 새 구조만 있는 입력으로 컬럼 이름/타입/순서 검증                                                                                 |
| `lib/dsl-generator.ts`, `components/erd/DslCodeEditorPanel.tsx`                                                                                            | graph query 또는 preview/shared-draft의 plain 노드 입력. Y.Map 직접 접근 없음                                                                                  |
| `collaboration/plugins/erd/erd-document-plugin.ts`, `lib/diagram-definition-export.ts`, `components/erd/ERDCanvas.tsx`, `components/erd/PreviewCanvas.tsx` | artifact는 `yDocToJson`, 정의서는 현재 plain 노드 직렬화. 새 구조만 있는 문서의 artifact/bootstrap 및 정의서 JSON 검증                                         |

## S2-B 서버 읽기 전용 점검 (2026-11-16)

`src/main/java` 전체의 `columns`/`columnsById`/`columnOrder`, Y.Doc 타입과 JSON 파싱
검색 결과, **Yjs update 내부 테이블/컬럼 구조 파서는 없다.** 다만 별도 content JSON을
해석하는 아래 세 소비자는 존재한다. 이 구분 때문에 plain `data.columns` 계약을 유지한다.
Java 수정이나 서버/DB 통합 테스트는 수행하지 않았다.

아래 경로는 `src/main/java/com/smarterd/` 기준이다.

| 파일:행                                                                                                             | 확인 결과                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `domain/diagram/websocket/protocol/YjsUpdateFormat.java:63`, `:100`                                                 | magic/4-byte length로 byte[] 묶음을 분리하며, raw update는 그대로 반환. Yjs struct/테이블/컬럼을 디코딩하지 않음    |
| `domain/diagram/service/DiagramSnapshotEncodingSupport.java:35`                                                     | 기존 snapshot과 update 목록을 바이트 묶음으로 연결                                                                  |
| `domain/diagram/service/DiagramSnapshotPersistenceSupport.java:44`, `:75`                                           | content revision 잠금/비교 후 opaque snapshot 저장·교체                                                             |
| `domain/diagram/service/DiagramSnapshotCompactionSupport.java:47`                                                   | revision·바이트 크기·쿨다운 검사 후 클라이언트 compacted update를 포장해 저장. 구조 파싱 없음                       |
| `domain/diagram/websocket/relay/DiagramHandoffSnapshotResponder.java:95`                                            | v1 handoff에서 바이트 묶음만 분리해 전달                                                                            |
| `domain/diagram/websocket/relay/handler/YjsUpdateMessageHandler.java:48`, `CompactedSnapshotMessageHandler.java:41` | 메시지 타입 바이트를 제외한 payload 전달                                                                            |
| `application/diagram/command/SaveDiagramAuthoritativeContentUseCase.java:35`                                        | content 문자열 저장, snapshot 바이트 포장, revision 정렬. Markdown 전용 descriptor 분기와 ERD 컬럼 구조 처리는 별개 |
| `domain/diagram/entity/Diagram.java:168`, `:196`                                                                    | content 문자열/revision 갱신과 snapshot byte[] 대입. 컬럼 구조 파싱 없음                                            |
| `domain/diagram/service/DiagramRealtimeSnapshotStateSupport.java:72`                                                | snapshot 캐시/room 정렬 시 opaque full-state update 포장                                                            |
| `domain/diagram/service/DiagramColumnDefinitionExportService.java:115`, `:139`                                      | **content JSON 파싱 있음**: `nodes[].data.columns` plain 배열에서 컬럼 정의서 생성                                  |
| `domain/diagram/service/DiagramIndexDefinitionExportService.java:88`, `:110`                                        | **content JSON 파싱 있음**: 같은 plain 배열에서 PK/인덱스 정의서 생성                                               |
| `domain/diagram/service/DiagramDictionaryBindingService.java:76`, `:157`                                            | **content JSON 파싱/수정 있음**: plain 컬럼 배열의 사전 바인딩 무효화                                               |
| `domain/diagram/service/DiagramTableDefinitionExportService.java:101`                                               | content JSON의 노드/테이블 메타데이터 파싱. 컬럼 배열 접근 없음                                                     |

남은 위험은 구버전 쓰기 차단 미구현, 서로 다른 레거시 상태로부터의 동시 이관,
결정적 seed 해시 충돌 가능성과 Yjs 내부 Item 의존성이다. 실제 브라우저/WS/DB 수명주기,
구버전 바이너리 실행, PNG/PDF 화면 캡처는 이 단계에서 검증하지 않았다. 테스트의
snapshot/update는 실제 Yjs 바이트지만 Java length-prefixed 전송 계층의 통합 검증은 아니다.
