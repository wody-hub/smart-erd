# ERD Local Dictionary Design (Phase 2)

- Date: 2026-10-12
- Scope: 로컬 모드(`/erd-local`) 전용 사전. 도메인+용어+단어 전부, 직접 등록 + JSON 파일 저장/열기
- Non-goals: 서버 사전 연동/동기화, 엑셀 import/export, 서버 추천 API, 팀 사전 공유

## Architecture

`ErdLocalPage`에서 기존 `ErdDictionaryProvider(teamId, setId)` 대신 `ErdLocalDictionaryProvider`를 장착한다. Provider가 노출하는 값의 모양은 `useErdDictionaryData` 반환과 동일하게 유지한다 (terms/domains/words, `termByNameMap`, `domainByNameMap`, `domainMap`, `wordMatchIndex`, `searchTerms`, `findTermById/findDomainById/findWordById`, `getTermWithType`, `resolveLogicalName`, `isDictionaryReady`, `dictionaryRevision`).

데이터 소스만 교체한다: 서버 `useQuery` 3종 → localStorage 기반 로컬 저장소 + 메모리 상태. 이렇게 하면 하위 소비자(`TableNode`, `ColumnAutocomplete`, `ValidationPanel`/`useColumnValidation`, `useDiagramDictionaryReconciliation`, DSL 패널 주입값)를 수정 없이 재사용한다.

`useDictionarySuggest`(서버 추천)는 로컬에서 제외한다. Quick 계열 다이얼로그의 domain 자동채움은 로컬 완전매칭(`analyzeWordComposition` + `isCompleteMatch`)으로 대체한다.

## Components

| 컴포넌트 | 위치 | 내용 |
|---|---|---|
| 저장 헬퍼 | `lib/erd-local-dictionary-storage.ts` | 신규. `read/writeErdLocalDictionary(storage)`, `parseErdLocalDictionaryFile(text)` 순수 함수. `ErdLocalStorageLike` 재사용 |
| 저장 키 | `constants/storage.ts` | `STORAGE_KEYS.ERD_LOCAL_DICTIONARY` 추가 (`'smart-erd-erd-local-dictionary'`) |
| 상태 훅 | `pages/erd-local/useErdLocalDictionary.ts` | 신규. 로컬 CRUD (id는 `local-<counter>` 문자열? 타입이 number이므로 로컬 전용 별도 id 체계 필요 — 아래 참조) + `dictionaryRevision` + 파생맵은 `erdDictionaryData`의 기존 순수 로직 재사용 |
| Provider | `pages/erd-local/ErdLocalDictionaryProvider.tsx` | 신규. 훅 값을 기존 `ErdDictionaryContext`와 동일한 모양으로 공급 |
| 관리 UI | `pages/erd-local/` | 신규. 도메인/용어/단어 간소 탭 + 생성/수정 다이얼로그 3종. 기존 `DomainTab/TermTab/WordTab`, `BulkUploadDialog`는 서버 mutation 종속이라 재사용하지 않음 |
| 파일 버튼 | `ErdLocalPage` 상단 바 | JSON 저장/열기 (단일 파일 `{version, domains, terms, words}`) |
| i18n | `locales/{ko,en}` | `erdLocalDictionary.*` 키 |

id 체계: 서버 타입의 `id: number`는 로컬에서 collisions 없이 생성하기 어렵다. 로컬 저장 형식은 서버 타입과 분리된 `LocalDomain/LocalTerm/LocalWord` (id: string, `local-` prefix + counter/timestamp)로 정의하고, Provider 경계에서 기존 소비자가 기대하는 모양으로 매핑한다. 파일 형식도 이 로컬 타입 기준이다. 서버 형식과 호환을 약속하지 않는다 (Out of scope: 서버 동기화).

## Data Flow

1. 진입: localStorage 드래프트 있으면 로드, 손상 시 삭제 후 빈 사전.
2. 직접 등록: 다이얼로그 → 유효성(논리명/물리명 필수, 중복 논리명 경고) → 저장소 기록 → `dictionaryRevision` 갱신 → ERD 자동완성·검증에 즉시 반영.
3. 파일 저장: `{version: 1, domains, terms, words}` JSON 다운로드.
4. 파일 열기: 파싱+형식 검증 → 교체. 실패 시 기존 유지 + 토스트.
5. 삭제: 확인 다이얼로그 후 제거. 용어가 참조하는 도메인 삭제 시 해당 용어의 `domainId`는 null로 해제 (고아 방지).

## Error Handling

- 기존 패턴: `toast.error(t('erdLocalDictionary.*'))`, 인라인 에러 금지.
- 손상 localStorage/파일: 기존 데이터 유지, 삭제는 유효한 교체가 확정된 후에만.
- localStorage 용량 초과: `erdLocal.storageFull` 메시지 재사용 + 파일 저장 유도.
- 금지 import 유지: `pages/erd-local/`에서 `api/*`, `useAuthStore` 참조 금지 (Task 5 격리 grep에 사전 파일 포함).

## Testing

- 단위 (`node --test`): 저장 헬퍼 round-trip, 손상 입력 처리, 파일 형식 검증 (버전 불일치, 필드 누락), id 생성 유일성.
- 기존 회귀: erd-local 테스트 + tsc + prettier 유지.
- 수동: 용어 등록 → 컬럼 논리명 입력 시 자동완성·물리명 추천 → 검증 패널 matched 확인 → 파일 저장/열기 왕복 → 도메인 삭제 시 용어 해제 확인.
