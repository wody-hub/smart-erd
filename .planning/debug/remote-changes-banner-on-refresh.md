---
status: verifying
trigger: "Remote changes pending 배너가 단일 사용자 새로고침 시 매번 표시되는 문제"
created: 2026-04-03T00:00:00Z
updated: 2026-04-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - WebSocket SYNC_STEP2의 'remote' origin이 useBidirectionalCodeSync에서 remote-pending으로 처리됨
test: canAbsorbInitialSyncRef 플래그로 사용자 편집 전 리비전 변경 흡수
expecting: 새로고침 시 배너 미표시, 실제 다른 사용자 변경 시에는 정상 표시
next_action: 사용자에게 검증 요청

## Symptoms

expected: 단일 사용자가 다이어그램 페이지를 새로고침하면 "Remote changes pending" 배너가 표시되지 않아야 함
actual: 혼자 사용하는 경우에도 새로고침할 때마다 "Remote changes pending" 배너가 표시됨
errors: 에러 없음, UX 문제
reproduction: 1. 다이어그램에 테이블 추가 등 변경 수행 2. 저장 확인 3. 페이지 새로고침 4. "Remote changes pending" 배너가 나타남
started: 실시간 협업 기능 구현 후 발생

## Eliminated

- hypothesis: YjsProvider에서 SYNC_STEP2 origin을 'bootstrap'으로 변경
  evidence: DocumentStore가 'bootstrap' origin을 완전히 무시하므로, canvas에 초기 데이터가 표시되지 않는 부작용 발생
  timestamp: 2026-04-03

- hypothesis: collaborationReadyRef로 remote event 필터링 (사용자 기존 시도)
  evidence: ERD 다이어그램 채널에서는 onSyncStateChange를 바인딩하지 않아 sync 완료 시점을 알 수 없음. Markdown에서만 동작.
  timestamp: 2026-04-03

## Evidence

- timestamp: 2026-04-03
  checked: YjsProvider SYNC_STEP2/SNAPSHOT_RESPONSE 처리 (YjsProvider.ts:376-414)
  found: 초기 WebSocket sync 시 SYNC_STEP2와 SNAPSHOT_RESPONSE 모두 'remote' origin으로 Y.applyUpdate 호출
  implication: DocumentStore가 이를 실제 원격 변경으로 처리하여 lastDocumentChange 이벤트 발행

- timestamp: 2026-04-03
  checked: DocumentStore.handleRevisionChanged (document-store.ts:104-126)
  found: 'bootstrap' origin은 무시하지만 'remote' origin은 정상적으로 change event 발행. 초기 sync의 'remote' origin을 구분할 수 없음
  implication: 초기 sync에서 오는 remote change event가 currentRevisionHash 변경을 유발

- timestamp: 2026-04-03
  checked: useBidirectionalCodeSync revision tracking effect (lines 184-209)
  found: |
    1. 마운트 시 lastObservedErdRevisionRef = null, 첫 currentRevisionHash(빈 그래프 해시)를 저장하고 return
    2. WebSocket sync 완료 -> currentRevisionHash가 실제 컨텐츠 해시로 변경
    3. lastObservedErdRevisionRef(빈 해시) != currentRevisionHash(컨텐츠 해시) -> pendingRemoteRevision 설정
    4. draftState.reconcileState = 'remote-pending' -> 배너 표시
  implication: 이것이 root cause. 빈 Y.Doc에서 sync된 데이터로의 첫 리비전 변경이 remote-pending으로 처리됨

- timestamp: 2026-04-03
  checked: YjsSharedDocumentEngine.hydrate() 사용 여부
  found: hydrate() 메서드는 정의되어 있지만 ERD 다이어그램 플로우에서는 호출되지 않음. Y.Doc 데이터는 오직 WebSocket sync를 통해 'remote' origin으로 채워짐
  implication: ERD 채널의 초기 데이터 로드 경로가 'remote' origin을 사용하는 것이 구조적 원인

## Resolution

root_cause: |
  WebSocket 초기 sync(SYNC_STEP2/SNAPSHOT_RESPONSE)가 Y.Doc에 'remote' origin으로 적용됨.
  useBidirectionalCodeSync의 revision tracking이 이 변경을 실제 원격 사용자의 변경으로 오인하여
  pendingRemoteRevision을 설정, draftState.reconcileState = 'remote-pending'이 되어 배너가 표시됨.
  ERD 채널에서는 Markdown과 달리 onSyncStateChange를 바인딩하지 않아 초기 sync 완료 시점을
  구분할 수 없고, collaborationReadyRef 패턴을 적용할 수 없었음.

fix: |
  useBidirectionalCodeSync에 canAbsorbInitialSyncRef 플래그 추가.
  - 마운트 시 true로 시작
  - 사용자가 코드 편집(handleUserCodeChange)을 시작하면 false로 전환
  - true인 동안 리비전 변경은 remote-pending으로 처리하지 않고 조용히 수락
  - ERD→코드 자동 동기화가 활성이면 코드가 자동 갱신되므로 UX 영향 없음

verification: TypeScript 컴파일 성공, ESLint 통과. 사용자 검증 대기 중.
files_changed:
  - client/src/hooks/useBidirectionalCodeSync.ts

## RESOLVED

**Verified:** 2026-04-03 via headless browser
- ERD-only mode reload: no banner
- Code-first mode reload: no banner
- Console errors: none
