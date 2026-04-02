# 구현 계획서: 마크다운 에디터 플러그인

## 0. 목적

이 문서는 `plan-review.md`에서 지적된 리스크를 해소한 뒤, 현재 `smart-erd` 코드베이스 위에 마크다운 문서 편집기를 실제로 구현하기 위한 실행 계획서다.

목표는 두 가지다.

1. 기존 협업 문서 코어와 `pluginId` 기반 bootstrap 흐름 위에 `markdown` 플러그인을 추가한다.
2. 현재 프로젝트가 이미 사용 중인 `diagram` 기반 API/route/query 구조를 최대한 재사용하면서, 사용자 경험은 `문서 플랫폼` 기준으로 확장한다.

## 1. 최종 결정

### 1.1 이번 구현의 기준 결정

- URL은 당분간 기존 `/teams/:teamId/projects/:projectId/diagrams/*` 경로를 유지한다.
- 백엔드 REST도 기존 `DiagramController` 계열을 유지하되, payload와 응답에 `pluginId`를 추가하여 `erd`와 `markdown`을 함께 수용한다.
- DB 엔티티 이름 `Diagram`은 이번 범위에서 유지한다. 대신 **의미상 문서 aggregate**로 확장한다.
- 프론트 편집 route는 기존 `ROUTES.DIAGRAM_PATTERN`을 유지하되, 실제 렌더링은 bootstrap `pluginId`에 따라 ERD/Markdown editor를 분기한다.
- 마크다운의 canonical collaborative state는 `Y.Text(body)` + `Y.Map(frontmatter)` + `Y.Map(metadata)`다.
- DB `content`와 REST `content`는 **compatibility artifact / editor buffer**로 취급한다. 즉, 저장되는 문자열은 `frontmatter + body`를 직렬화한 전체 마크다운 문서다.
- 1차 구현 범위에서는 section lock을 완전하게 열지 않는다. 텍스트 편집은 우선 `document/root` lock을 기본으로 하고, `section.update` 커맨드와 section index가 안정된 뒤 section lock을 연다.
- HTML preview / export는 1단계부터 sanitize를 강제한다.
- export는 이번 단계에서 `md`, `html`만 지원한다. `pdf`는 renderer 의존성과 출력 기준이 잠기지 않았으므로 후속 phase로 미룬다.
- 이미지 업로드는 현재 코드베이스에 `AssetRuntime`/upload API가 없으므로 **후행 단계로 격리**한다.

### 1.2 이번 구현에서 하지 않는 것

- 새 `DocumentController`/`DocumentRepository`/`documents` 테이블로의 전면 전환
- WYSIWYG 블록 에디터
- MDX
- 댓글/리뷰 시스템
- 이미지 업로드와 asset GC의 실제 구현

## 2. 아키텍처 요약

## 2.1 프론트엔드

```text
Documents Hub
  -> 기존 DiagramsPage가 pluginId 포함 목록을 표시
  -> 문서 생성 시 type=erd|markdown 선택

Document Editor Route (/diagrams/:documentId)
  -> Document bootstrap 조회
  -> pluginId에 따라 editor 분기
     - erd      -> 기존 DiagramPage runtime
     - markdown -> 신규 MarkdownDocumentPage runtime
```

핵심 원칙:

- 공통 bootstrap/session orchestration은 기존 `collaboration/core/*`를 그대로 사용한다.
- ERD 전용 구현은 `components/erd`, `stores/erd`, `collaboration/plugins/erd`에 남긴다.
- Markdown 전용 UI는 `components/markdown`, `pages/document`, `collaboration/plugins/markdown`에 둔다.
- 공통 상단 shell, hub row, empty state는 `components/layout`, `components/workspace`를 그대로 재사용한다.

## 2.2 백엔드

```text
Diagram aggregate (semantic document aggregate)
  -> pluginId 로 erd / markdown 구분
  -> content 는 compatibility artifact 역할
  -> ydocSnapshot 은 shared document canonical snapshot 역할

Document bootstrap metadata
  -> documentId -> pluginId, engineId, revision 조회
  -> plugin registry + bootstrap reader가 plugin-aware 하게 동작
```

핵심 원칙:

- HTTP 계층은 계속 `api/diagram/*` 아래에 둔다.
- 비즈니스 로직은 `domain/diagram/service/*`, `domain/markdown/*`, `collaboration/*`로 나눈다.
- 협업 코어 계약은 `src/main/java/com/smarterd/collaboration/*`를 재사용한다.

## 3. 데이터 모델 설계

## 3.1 `diagrams` 테이블 확장

### 추가 컬럼

| 컬럼 | 타입 | 제약 | 용도 |
|---|---|---|---|
| `plugin_id` | varchar(32) | not null, default `'erd'` | 문서 플러그인 식별자 |

### 기존 컬럼 사용 정책

| 컬럼 | ERD | Markdown |
|---|---|---|
| `name` | 문서명 | 문서명 |
| `dictionary_set_id` | 사용 | null 유지 |
| `content` | 기존 JSON/compatibility artifact | `serialize(frontmatter, body)` 결과 |
| `ydoc_snapshot` | Yjs snapshot | Yjs snapshot |
| `content_revision` | 사용 | 사용 |
| `snapshot_revision` | 사용 | 사용 |

### 마이그레이션 전략

1. `plugin_id` 추가
2. 기존 행은 모두 `'erd'`로 backfill
3. `Diagram` 엔티티와 projection에 `pluginId` 추가
4. bootstrap metadata service / reader가 hard-coded default 대신 entity `pluginId`를 기준으로 동작하도록 수정

## 3.2 프론트 canonical buffer 규칙

마크다운은 아래 3개 층을 명시적으로 분리한다.

| 층 | 정체성 | 역할 |
|---|---|---|
| editor buffer | `---yaml--- + markdown body` 전체 문자열 | Monaco 표시 및 REST fallback content |
| shared state | `Y.Map(frontmatter)` + `Y.Text(body)` | 협업 canonical source |
| projected view | TOC / diagnostics / preview HTML | 렌더 파생값 |

### 고정 규칙

- Monaco는 항상 **serialized buffer**를 보고 편집한다.
- `parse()`는 buffer를 `frontmatter + body`로 분리한다.
- `buildCommands()`는 `frontmatter.update`, `body.replace`, `section.update` 계열 커맨드를 만든다.
- 저장 직전에는 현재 shared state를 다시 serialize하여 `content` artifact를 만든다.
- `content`는 preview source가 아니라 bootstrap fallback source다.

이 규칙으로 `frontmatter` source of truth 분산 문제를 제거한다.

## 4. API 설계

## 4.1 기존 다이어그램 API 확장

### 1. 문서 생성

`POST /api/teams/{teamId}/projects/{projectId}/diagrams`

#### 요청 DTO

```java
public record CreateDiagramRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank String pluginId,
    @Nullable Long dictionarySetId,
    @Nullable String templateKey
) {}
```

규칙:

- `pluginId = "erd"`면 `dictionarySetId` 필수
- `pluginId = "markdown"`면 `dictionarySetId`는 null이어야 함
- `pluginId = "markdown"`면 `templateKey` 허용

### 2. 문서 목록/상세/부트스트랩

기존 엔드포인트 유지:

- `GET /diagrams`
- `GET /diagrams/{diagramId}`
- `GET /diagrams/{diagramId}/bootstrap`

응답 확장:

- `pluginId` 추가
- markdown 문서는 `dictionarySetId`, `dictionarySetName`가 null

### 3. 문서 저장

기존 `PUT /diagrams/{diagramId}` 유지

#### 요청 해석

- ERD: 기존 JSON content + ydocSnapshot
- Markdown: serialized markdown buffer + ydocSnapshot

서버는 `pluginId`에 따라 저장 검증 경로를 분기한다.

### 4. 문서 export

신규 엔드포인트:

`POST /api/teams/{teamId}/projects/{projectId}/diagrams/{diagramId}/exports`

#### 요청 DTO

```java
public record ExportDocumentRequest(
    @NotBlank String format // html | md
) {}
```

#### 응답 정책

- `md`: `text/markdown`
- `html`: `text/html`

이번 구현에서는 markdown 전용 `md`, `html` export만 지원한다.
ERD의 기존 엑셀 export 엔드포인트는 유지한다.
`pdf`는 후속 phase에서 구현 주체(서버 renderer vs 클라이언트 생성)가 정해진 뒤 추가한다.

## 4.2 이미지 업로드

이번 범위에서 **엔드포인트를 만들지 않는다**.

이유:

- 현재 코드베이스에 asset runtime / asset lifecycle / file upload 표준 경로가 없음
- 설계 문서의 `asset://` 흐름을 당장 구현하면 별도 파일 도메인 설계가 같이 들어와야 함

대신 implementation plan에서는:

- `image.insert` command 인터페이스는 예약
- 실제 업로드 버튼과 `asset://` 삽입은 후속 phase로 분리

## 4.3 실시간 협업 API / 채널

### 이번 단계의 결정

- websocket ticket 발급 경로는 기존 `/api/ws-ticket`를 유지한다.
- ticket payload와 handshake 대상 식별자도 1차 구현에서는 기존 `diagramId`를 유지한다.
- 이유는 markdown 문서도 물리적으로는 같은 `diagrams` 행을 사용하고, 협업 전송 계층은 플러그인별 의미를 해석하지 않고 **opaque Yjs delta + snapshot handoff**만 전달하기 때문이다.
- 즉, 이번 단계에서 필요한 것은 새로운 markdown 전용 websocket API가 아니라, 기존 diagram collaboration 경로가 `pluginId=markdown` 행도 정상 bootstrap / handshake / handoff 하도록 일반화하는 것이다.

### 반드시 수정/검증할 기존 경로

- `src/main/java/com/smarterd/api/diagram/WsTicketController.java`
- `src/main/java/com/smarterd/application/diagram/command/IssueDiagramCollaborationTicketUseCase.java`
- `src/main/java/com/smarterd/application/diagram/command/ValidateDiagramCollaborationHandshakeUseCase.java`
- `src/main/java/com/smarterd/collaboration/session/DiagramRealtimeSessionUseCase.java`
- `src/main/java/com/smarterd/collaboration/handoff/DiagramHandoffSnapshotResponder.java`
- `src/main/java/com/smarterd/collaboration/ws/WsTicketHandshakeInterceptor.java`

### 명시적 비목표

- 이번 phase에서 REST / websocket naming을 `diagram` -> `document`로 바꾸지 않는다.
- naming debt는 Phase 6 후속 작업으로 격리한다.

## 5. 백엔드 구현 계획

## 5.1 DTO / Controller

### 수정 파일

- `src/main/java/com/smarterd/api/diagram/dto/CreateDiagramRequest.java`
- `src/main/java/com/smarterd/api/diagram/dto/DiagramResponse.java`
- `src/main/java/com/smarterd/api/diagram/dto/DiagramDetailResponse.java`
- `src/main/java/com/smarterd/api/diagram/DiagramController.java`

### 신규 파일

- `src/main/java/com/smarterd/api/diagram/dto/ExportDocumentRequest.java`

### 규칙

- DTO는 `record`
- `@Valid` 사용
- enum/format 검증은 request validator 또는 service에서 2차 검증

## 5.2 도메인 / 서비스

### 수정 파일

- `src/main/java/com/smarterd/domain/diagram/entity/Diagram.java`
- `src/main/java/com/smarterd/domain/diagram/repository/DiagramRepository.java`
- `src/main/java/com/smarterd/domain/diagram/repository/DiagramRepositoryCustom.java`
- `src/main/java/com/smarterd/domain/diagram/repository/DiagramRepositoryCustomImpl.java`
- `src/main/java/com/smarterd/domain/diagram/service/DiagramService.java`

### 신규 파일

- `src/main/java/com/smarterd/domain/diagram/entity/DocumentPluginType.java`
- `src/main/java/com/smarterd/domain/markdown/service/MarkdownExportService.java`
- `src/main/java/com/smarterd/domain/markdown/service/MarkdownTemplateService.java`
- `src/main/java/com/smarterd/domain/markdown/service/MarkdownDocumentValidationService.java`

### 책임 분리

- `DiagramService`
  - 생성/목록/상세/이름변경/삭제 공통 orchestration
  - `pluginId`별 필수값 검증 위임
- `MarkdownDocumentValidationService`
  - `pluginId=markdown` 전용 저장/export 가능성 검증
  - sanitize allowlist 정책 공유
- `MarkdownTemplateService`
  - 초기 template buffer 생성
- `MarkdownExportService`
  - HTML/MD export

### 트랜잭션 규칙

- 서비스 클래스 레벨 `@Transactional(readOnly = true)`
- 생성/저장/삭제/export 기록성 작업만 메서드 레벨 `@Transactional`
- `MarkdownExportService`는 readOnly 유지

## 5.3 협업 / bootstrap / persistence

### 실제 코드 기준 경로

- 공통 collaboration 코어:
  - `src/main/java/com/smarterd/collaboration/*`
- diagram 문서 메타 서비스:
  - `src/main/java/com/smarterd/domain/diagram/collaboration/*`

### 신규 파일

- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownCollaborationDocumentDefaults.java`
- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownScopeResolver.java`
- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownDomainValidationHook.java`
- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownArtifactSerializer.java`
- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownArtifactCodec.java`
- `src/main/java/com/smarterd/domain/markdown/collaboration/MarkdownCollaborationPlugin.java`

### 수정 파일

- `src/main/java/com/smarterd/domain/diagram/collaboration/DiagramDocumentMetadataService.java`
- `src/main/java/com/smarterd/domain/diagram/collaboration/DiagramDocumentBootstrapReader.java`
- `src/main/java/com/smarterd/collaboration/plugin/CollaborationPluginRegistry` 구현체
- `src/main/java/com/smarterd/api/diagram/WsTicketController.java`
- `src/main/java/com/smarterd/application/diagram/command/IssueDiagramCollaborationTicketUseCase.java`
- `src/main/java/com/smarterd/application/diagram/command/ValidateDiagramCollaborationHandshakeUseCase.java`
- `src/main/java/com/smarterd/collaboration/session/DiagramRealtimeSessionUseCase.java`
- `src/main/java/com/smarterd/collaboration/handoff/DiagramHandoffSnapshotResponder.java`
- `src/main/java/com/smarterd/collaboration/ws/WsTicketHandshakeInterceptor.java`

### 핵심 변경

#### 문서 메타데이터

현재는 `DocumentMetadataService`가 문서의 `pluginId`를 하드코딩 `erd`로 반환한다.

수정 후:

- `Diagram` 엔티티의 `pluginId`를 읽어서 반환
- `pluginId`별 engine/version defaults 선택

#### bootstrap header

현재 `DiagramDocumentBootstrapReader`는 `DiagramCollaborationDocumentDefaults`를 하드코딩한다.

수정 후:

- `pluginId`로 plugin defaults 선택
- `artifactVersion`도 plugin별로 결정

#### validation hook

- markdown hook는 저장 시 최소 무결성만 본다.
- 1차 구현에서는 section index 완전성보다
  - frontmatter YAML parse 가능
  - sanitized HTML 생성 가능
  - snapshot/body serialization roundtrip 가능
  를 우선 검증한다.

#### realtime channel 일반화

- 별도 markdown websocket channel을 추가하지 않는다.
- 기존 diagram collaboration channel이 `pluginId=markdown` 문서도 받아들이도록 일반화한다.
- handshake / session / handoff 레이어는 plugin-specific command semantics를 몰라도 되며, 문서 식별자와 Yjs payload 전달만 보장하면 된다.
- plugin별 해석은 bootstrap 이후 프론트 plugin runtime과 backend plugin registry에서 처리한다.

## 6. 프론트엔드 구현 계획

## 6.1 타입 / 상수 / API

### 신규 파일

- `client/src/types/document.ts`
- `client/src/types/markdown.ts`
- `client/src/api/documentExportApi.ts`

### 수정 파일

- `client/src/types/diagram.ts`
- `client/src/api/diagramApi.ts`
- `client/src/constants/query-keys.ts`
- `client/src/constants/routes.ts`

### 타입 설계

```ts
export type DocumentPluginId = 'erd' | 'markdown';

export interface ProjectDocumentSummary {
  id: number;
  name: string;
  pluginId: DocumentPluginId;
  projectId: number;
  dictionarySetId: number | null;
  dictionarySetName: string | null;
  templateKey: string | null;
  templateLabel: string | null;
  summaryText: string | null;
  createdAt: string;
  updatedAt: string;
}
```

전략:

- 기존 `DiagramSummary/DiagramDetail`는 유지하되 `pluginId`를 추가
- 신규 UI는 `ProjectDocumentSummary` alias를 우선 사용
- markdown row의 `template/use-case 요약`은 `templateLabel`, `summaryText`를 통해 내려준다.

## 6.2 문서 허브

### 수정 파일

- `client/src/pages/diagram/DiagramsPage.tsx`
- `client/src/components/workspace/DocumentHubRow.tsx`
- `client/src/components/workspace/DocumentTypeBadge.tsx`
- `client/src/components/workspace/CreateDocumentDialog.tsx`
- `client/src/hooks/useDiagramDocumentHubActions.ts`

### 변경 내용

- 생성 UX를 단일 modal 입력이 아니라 `2-step create flow`로 바꾼다.
- Step 1: `ERD` / `Markdown` 유형 카드 선택
- Step 2-A: ERD면 dictionary context + 문서명 입력
- Step 2-B: Markdown이면 template 카드 + 문서명 입력
- 목록 row에서 `pluginId` 기반 badge 렌더링
- markdown 문서는 dictionary context 대신 template/use-case 요약을 표시
- 기존 generic `CreateResourceDialog`는 이 플로우를 표현하기 부족하므로 문서 허브 전용 `CreateDocumentDialog`로 교체한다.

## 6.3 편집 route 분기

### 신규 파일

- `client/src/pages/document/DocumentEditorRoute.tsx`
- `client/src/pages/document/use-document-editor-bootstrap.ts`

### 수정 파일

- `client/src/App.tsx`
- `client/src/pages/diagram/DiagramPage.tsx`

### 변경 전략

현재 `ROUTES.DIAGRAM_PATTERN`은 직접 `DiagramPage`를 렌더링한다.

수정 후:

1. route는 `DocumentEditorRoute`를 렌더링
2. `DocumentEditorRoute`가 bootstrap query를 먼저 수행
3. `pluginId`에 따라 아래로 분기
   - `erd` -> 기존 `DiagramPage`
   - `markdown` -> 신규 `MarkdownDocumentPage`

이 방식으로 URL/권한/ProtectedRoute는 유지하면서 plugin-aware editor를 도입한다.

추가 원칙:

- markdown editor도 기존 workspace header shell을 그대로 사용한다.
- 새 top-level navigation이나 markdown 전용 독립 헤더는 만들지 않는다.
- editor right slot만 markdown 전용 utility rail로 교체한다.

## 6.4 Markdown 프론트엔드 파일 배치

### 신규 파일

```text
client/src/collaboration/plugins/markdown/
├── markdown-document-plugin.ts
├── markdown-text-input-pipeline.ts
├── markdown-mutation-policy.ts
├── markdown-projector.ts
├── markdown-scope-resolver.ts
├── markdown-artifact-serializer.ts
├── markdown-artifact-codec.ts
├── markdown-preview-sanitize.ts
├── markdown-sanitize-policy.generated.ts
├── markdown-buffer.ts
└── markdown-types.ts

client/src/collaboration/channel/document/
├── use-markdown-runtime-bootstrap.ts
└── use-markdown-document-runtime.ts

client/src/collaboration/yjs/
└── markdown-yjs-document-adapter.ts

client/src/pages/document/
├── MarkdownDocumentPage.tsx
├── use-markdown-document-session.ts
└── markdown-collaboration-bootstrap.ts

client/src/components/markdown/
├── MarkdownEditorShell.tsx
├── MarkdownOutlineRail.tsx
├── MarkdownEditorPane.tsx
├── MarkdownPreviewPane.tsx
├── MarkdownInfoDrawer.tsx
├── MarkdownStatusStrip.tsx
├── MarkdownToolbar.tsx
└── RemotePendingBanner.tsx
```

### 파일 배치 원칙

- route/page orchestration은 `pages/document`
- plugin contract 구현은 `collaboration/plugins/markdown`
- runtime bootstrap/orchestration은 `collaboration/channel/document`
- Yjs adapter는 `collaboration/yjs`
- markdown 전용 시각 UI는 `components/markdown`
- 공통 shell은 기존 `components/layout`, `components/workspace` 유지
- metadata/settings는 고정 우측 컬럼이 아니라 drawer/sheet 컴포넌트로 구현한다.

## 6.5 마크다운 협업 계약

### 실제 프론트 계약 기준

현재 코드의 plugin contract는 아래 기준을 따른다.

- command 식별자: `kind`가 아니라 `key`
- mutation 변환: `toMutation()`
- scope resolver: `resolve()`

따라서 markdown 설계도 아래처럼 실제 계약에 맞춘다.

```ts
type MarkdownCommandKey =
  | 'markdown:body-replace'
  | 'markdown:section-update'
  | 'markdown:frontmatter-update'
  | 'markdown:format-apply';
```

### 1차 scope 정책

- `markdown:body-replace` -> `document/root` exclusive
- `markdown:frontmatter-update` -> `document/root` exclusive
- `markdown:section-update` -> `section/{id}` exclusive
- 1차 배포에서는 Monaco 자유 입력이 주 경로이므로, 실질적으로 root lock 기준으로 시작한다.

section lock은 아래 조건이 충족될 때만 연다.

1. section index projector 안정화
2. changed range 기반 section resolution 가능
3. remote-pending/rebase path가 section-aware 하게 검증됨

## 6.6 markdown editor shell

### 레이아웃 원칙

- 기본 레이아웃은 `outline rail + write surface + preview surface`의 3-zone 구조다.
- `frontmatter/settings`는 항상 열린 4번째 컬럼이 아니라 `MarkdownInfoDrawer`로 처리한다.
- `MarkdownEditorShell`은 현재 workspace/editor shell 토큰을 재사용하고, display surface보다 operational surface 밀도를 따른다.

### 반응형 규칙

- desktop: outline + write + preview
- tablet: outline은 collapsible rail, info는 side sheet
- mobile: `Write / Preview / Outline` 3탭, info는 bottom sheet

### 보조 컴포넌트 책임

- `MarkdownOutlineRail.tsx`
  - heading 기반 navigation, section lock, collaborator 상태
- `MarkdownToolbar.tsx`
  - 자주 쓰는 포맷팅과 `Write / Split / Preview` 모드 전환
- `MarkdownInfoDrawer.tsx`
  - 제목, 상태, 태그, 문서 설정
- `MarkdownStatusStrip.tsx`
  - section, draft state, autosave, diagnostics
- `RemotePendingBanner.tsx`
  - 원격 변경 도착 시 slim banner

## 6.7 markdown runtime bootstrap

### 목적

`MarkdownDocumentPage`가 단순 page component만 추가되는 것이 아니라, 현재 ERD가 이미 쓰고 있는 collaboration bootstrap 규약을 같은 방식으로 타야 한다.

### bootstrap 순서

1. `DocumentEditorRoute`가 bootstrap query와 document detail query를 수행한다.
2. `pluginId === 'markdown'`이면 `MarkdownDocumentPage`로 분기한다.
3. `use-markdown-document-session`이 bootstrap 응답, detail 응답, collaboration session 상태를 묶는다.
4. `use-markdown-runtime-bootstrap`이 plugin registry, collaboration engine, markdown projector, text pipeline, sanitize policy를 엮어 runtime을 만든다.
5. snapshot이 있으면 `markdown-yjs-document-adapter`로 hydrate 한다.
6. snapshot이 비어 있으면 DB `content` artifact를 `markdown-artifact-codec` / `markdown-artifact-serializer`로 restore 한다.
7. 이후 Monaco 입력은 text pipeline -> command -> mutation -> Yjs adapter 순으로 흘러가고, preview/status/meta panel은 projector output만 소비한다.

### 구현 책임

- `markdown-collaboration-bootstrap.ts`
  - markdown 전용 runtime dependency 조립
- `use-markdown-runtime-bootstrap.ts`
  - bootstrap orchestration
- `use-markdown-document-runtime.ts`
  - 화면 레벨 runtime accessor
- `markdown-yjs-document-adapter.ts`
  - `Y.Text(body)` / `Y.Map(frontmatter)` hydrate / serialize
- `markdown-artifact-serializer.ts`
  - snapshot fallback용 buffer 직렬화

## 6.8 preview / export 보안 정책

### 신규 파일

- `client/src/collaboration/plugins/markdown/markdown-preview-sanitize.ts`
- `client/src/collaboration/plugins/markdown/markdown-sanitize-policy.generated.ts`
- `src/main/resources/markdown/markdown-sanitize-policy.json`
- `scripts/sync-markdown-sanitize-policy.mjs`

### 정책

- preview HTML과 export HTML은 동일 allowlist 사용
- allowlist의 canonical source of truth는 `src/main/resources/markdown/markdown-sanitize-policy.json`이다.
- 백엔드 export service는 이 파일을 classpath resource로 직접 읽는다.
- 프론트 preview sanitizer는 `scripts/sync-markdown-sanitize-policy.mjs`가 위 JSON을 읽어 생성한 `markdown-sanitize-policy.generated.ts`를 import한다.
- 허용:
  - heading, paragraph, emphasis, strong, code, pre, table, list, hr, blockquote
  - code highlight class
  - `img[src]`는 `https://`, `http://` 금지, 당장은 미허용 또는 same-origin blob만 허용
- 비허용:
  - inline event handler
  - script/style
  - raw iframe/object/embed

### 구현

- unified pipeline:
  - `remarkParse`
  - `remarkGfm`
  - `remarkRehype`
  - `rehypeHighlight`
  - `rehypeSanitize`
  - `rehypeStringify`
- `client build` 전에는 sanitize policy sync 스크립트를 실행해 프론트 generated module을 최신화한다.
- 백엔드 export도 동일 정책 fixture를 사용해 sanitize 결과를 golden test로 고정한다.

## 7. README 표준 반영 항목

이번 구현 전에 README도 아래 수준으로 같이 보강한다.

- `components/markdown/` 추가
- `pages/document/` 추가
- `collaboration/channel/document/`, `collaboration/yjs/`, `src/main/resources/markdown/` 추가
- 문서 플러그인 도메인 설명 추가
- 문서 허브에서 `pluginId` 기반 분기 규칙 추가

단, REST/API 파일은 계속 `api/diagram/*` 아래에 두므로 백엔드 패키지 테이블은 이번 범위에서 유지 가능하다.

## 8. 검증 / 트랜잭션 / 권한 설계

## 8.1 검증 3단계

### HTTP DTO

- `CreateDiagramRequest`
  - `name`
  - `pluginId`
  - `dictionarySetId`
  - `templateKey`

### Validator / Service

- markdown 생성 시
  - `pluginId == markdown`
  - `dictionarySetId == null`
  - `templateKey` 허용값 검사
- markdown 저장 시
  - buffer split 성공
  - frontmatter parse 성공
  - sanitize pipeline 통과 가능

### DomainValidationHook

- snapshot hydrate 후 최소 문서 무결성 검사
- invalid artifact면 `BusinessException` 또는 `ConflictException`으로 저장 거부

## 8.2 권한

- 생성/수정/삭제/export 모두 기존 diagram 문서와 동일하게 team membership 필요
- image upload는 후속 범위이므로 이번 구현에서 별도 권한 경로 없음

## 8.3 예외 처리

- plugin 미지원: `BusinessException`
- markdown sanitize 실패: `BusinessException`
- export format 미지원: `BusinessException`
- plugin mismatch bootstrap: 409 또는 400 대신 service 레벨 명시 예외

## 9. 테스트 전략

## 9.1 프론트 단위 테스트

- `markdown-buffer.ts`
  - frontmatter/body split
  - serialize/deserialize roundtrip
- `markdown-preview-sanitize.ts`
  - script 제거
  - 허용 태그 유지
- `markdown-scope-resolver.ts`
  - root lock
  - section key resolution
- `markdown-text-input-pipeline.ts`
  - parse diagnostics
  - invalid YAML

## 9.2 프론트 통합 테스트

- `use-markdown-document-session`
  - bootstrap -> detail -> runtime init
- `use-markdown-runtime-bootstrap`
  - snapshot hydrate
  - artifact fallback restore
  - projector / preview pipeline 연결
- `MarkdownDocumentPage`
  - dirty-valid
  - dirty-invalid
  - remote-pending banner

## 9.3 백엔드 단위 테스트

- `MarkdownTemplateService`
- `MarkdownExportService`
- `MarkdownDomainValidationHook`
- plugin-aware `DiagramDocumentMetadataService`
- plugin-aware `DiagramDocumentBootstrapReader`
- existing diagram websocket ticket / handshake / handoff 경로가 `pluginId=markdown` 행에도 동작하는지 검증
- sanitize policy sync 스크립트가 resource JSON과 generated TS module을 동일하게 유지하는지 검증

## 9.4 E2E / 브라우저

- 문서 허브에서 markdown 문서 생성
- markdown 문서 열기
- preview sanitize 확인
- 저장 후 재진입
- ERD 문서와 markdown 문서가 같은 허브에서 공존

## 10. 단계별 태스크 분해

### Phase 1. 문서 aggregate 확장

1. `plugin_id` DB migration
2. `Diagram` entity / repository / DTO / TS type에 `pluginId` 추가
3. 목록/생성/상세/bootstrap이 plugin-aware 하게 동작

### Phase 2. 편집 route generic host화

1. `DocumentEditorRoute` 도입
2. 기존 `DiagramPage`는 ERD 전용 page로 후퇴
3. bootstrap `pluginId` 기준 editor 분기
4. 문서 허브 생성 dialog를 `ERD/Markdown` 2-step flow로 교체

### Phase 3. Markdown plugin MVP

1. markdown document plugin 등록
2. markdown runtime bootstrap / Yjs adapter / artifact fallback 추가
3. markdown page + adaptive 3-zone editor shell
4. outline rail / info drawer / status strip
5. root lock 기반 text editing
6. sanitize preview

### Phase 4. 저장 / export / template

1. template 기반 생성
2. save / reopen
3. md/html export

### Phase 5. section-aware collaboration

1. section index projector
2. `section.update` command
3. section lock / remote pending refinement

### Phase 6. 후속

1. image upload / asset runtime 연계
2. 문서 API/경로 naming 정리 (`diagram` -> `document`)
3. pdf export renderer 전략 확정 및 구현

## 11. 구현 순서 제안

이번 저장소 기준 권장 순서는 아래다.

1. DB + backend DTO/service 확장
2. 문서 허브 `pluginId` 반영
3. generic editor route 도입
4. markdown plugin MVP
5. export
6. section lock 고도화

## 12. 완료 기준

- 문서 허브에서 `ERD`와 `Markdown` 두 유형이 함께 보인다
- markdown 문서 생성 시 template 선택 흐름이 동작한다
- markdown 문서를 생성/열기/저장/재열기 할 수 있다
- markdown editor가 desktop/tablet/mobile에서 adaptive layout으로 동작한다
- preview와 HTML export가 sanitize 정책을 공유한다
- `frontmatter`와 `body`가 split-brain 없이 roundtrip 된다
- 기존 ERD 편집기는 회귀 없이 그대로 동작한다
