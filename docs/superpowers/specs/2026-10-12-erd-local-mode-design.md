# ERD Local Mode Design (A안: 단일 빌드 + 공개 라우트)

- Date: 2026-10-12
- Scope: Phase 1 검증용. 로그인 없이 `/erd-local`에서 ERD 편집+저장+export
- Non-goals: 서버 저장/공유, 동시편집, 사전(도메인/용어), AI 챗, 엑셀 정의서 export (Phase 2)

## Architecture

단일 `client` 빌드 유지. `App.tsx`에 공개 라우트 1개 추가, 기존 인증 루트 손대지 않음.

```text
/erd-local (public, ProtectedRoute 밖)
  └── ErdLocalPage (pages/erd-local/)
        ├── ErdPermissionContext (canEdit=true 고정)
        ├── ERDCanvas (기존 재사용)
        ├── CanvasToolbar (export 메뉴 재사용, 서버 메뉴 숨김)
        ├── DdlCodeEditorPanel / DslCodeEditorPanel (재사용)
        └── local persistence (localStorage + JSON 파일)
```

진입점·번들 분리 없음. B안(빌드 플래그) 전환 시 `pages/erd-local/` 폴더째 진입점만 교체 가능하도록 독립 유지.

## Components

| 컴포넌트 | 위치 | 내용 |
|---|---|---|
| `ROUTES.ERD_LOCAL` | `constants/routes.ts` | `"/erd-local"` 상수 추가 |
| `ErdLocalPage` | `pages/erd-local/ErdLocalPage.tsx` | 신규. `teamId/projectId/diagramId` 없이 `useCanvasStore` 직접 구동 |
| 라우트 등록 | `App.tsx` | `GUIDE`와 동급 public route로 등록 |
| 저장 훅 | `pages/erd-local/useErdLocalPersistence.ts` | 신규. `serialize/deserialize` + localStorage autosave + 파일 import/export |
| 저장 키 | `constants/storage.ts` | `STORAGE_KEYS.ERD_LOCAL_DRAFT` 추가 |
| i18n | `locales/{ko,en}/translation.json` | `erdLocal.*` 키 (제목, 저장됨, 불러오기, 파일 관련) |

재사용 (수정 없음): `stores/useCanvasStore.ts`, `components/erd/ERDCanvas.tsx`, `TableNode.tsx`, `PreviewCanvas.tsx`, `lib/dsl-*`, `lib/ddl-*`, `lib/auto-layout.ts`, `lib/export/*`, `hooks/useExportDiagram.ts`.

제외 (import 금지): `api/diagramApi`, `stores/useAuthStore`, `use-diagram-document-session`, `use-document-editor-bootstrap`, `useTeamRole`, `ErdDictionaryProvider`, 협업 transport (`diagram-collaboration-transport`), `useAwareness`, `useRemoteEditLocks`, 엑셀 3종 (`downloadDiagramTable/Column/IndexDefinition`).

## Data Flow

1. 진입: `/erd-local` → localStorage 드래프트 있으면 `deserialize`, 없으면 빈 캔버스 + 샘플 1테이블 (빈 화면 방지).
2. 편집: 모든 변경은 `useCanvasStore` 메모리 상태. 기존 autosave 간격(`VITE_ERD_AUTOSAVE_*`) 재사용해 `STORAGE_KEYS.ERD_LOCAL_DRAFT`에 `serialize()` 저장.
3. 파일 저장: `JSON.stringify(serialize())` 다운로드. 파일 열기: 파싱 → `deserialize`, 실패 시 토스트 에러.
4. Export: `useExportDiagram` 그대로 (PNG/JPG/PDF/SVG). 서버 엑셀 버튼은 렌더하지 않음.
5. 새로 시작: 확인 다이얼로그(`ConfirmDialog`) 후 스토어 초기화 + 드래프트 삭제.

## Error Handling

- 원칙 준수: 인라인 에러 금지, `toast.error(getErrorMessage(err, t('erdLocal.*')))` 패턴.
- 파일 파싱 실패: `erdLocal.importError` 토스트, 기존 캔버스 유지 (덮어쓰지 않음).
- localStorage 용량 초과 (`QuotaExceededError`): 토스트 경고 + 파일 저장 유도, 크래시 금지.
- 언마운트 시 진행 중 autosave 타이머 정리.

## Testing

- 단위 (`node --test`): `useErdLocalPersistence` — serialize round-trip, 손상된 JSON 입력 시 기존 상태 유지, 손상된 localStorage 입력 시 빈 캔버스 폴백.
- 기존 회귀: `export-quality`, `export-executors` 테스트 통과 유지, `npx tsc --noEmit` clean.
- 수동: 무로그인 `/erd-local` 진입 → 테이블 추가 → 새로고침 후 복원 → JSON 저장/열기 → PNG/PDF export.
- E2E 제외 (Phase 1 범위 밖).

## B안 전환 메모 (참고, 구현 안 함)

- `pages/erd-local/` 무인증 import 규칙 유지가 전제.
- 나중에 `main-standalone.tsx` 진입점 + `VITE_ERD_MODE` 플래그로 auth/team/dictionary/AI 청크 제외.
- `electron-builder.yml`는 productName 오버라이드만으로 대응 가능.
