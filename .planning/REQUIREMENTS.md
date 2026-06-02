# Milestone v1.1 Requirements: AI 업무 실행 Gateway + Local Codex Chatbot

**Status:** PLANNING
**Defined:** 2026-05-29
**Core Value:** Smart-ERD의 SI PM 데이터를 AI가 안전하게 조회하고, 사용자가 승인한 낮은 위험도의 업무 등록/수정만 기존 서비스 경계를 통해 실행한다.

## Scope Summary

v1.1은 앱 내 AI 챗봇과 AI 실행 Gateway를 만든다. 첫 구현은 로컬/Electron MVP이며, 사용자의 PC에 설치되고 로그인된 Codex CLI를 Local Codex Adapter로 호출한다. OpenAI API key가 없어도 동작해야 하지만, provider abstraction을 유지해 이후 OpenAI API, Ollama, Claude 등으로 교체할 수 있어야 한다.

AI는 Smart-ERD 서버가 제공하는 도구로만 프로젝트 데이터를 읽고, 쓰기는 structured action proposal을 생성하는 데 그친다. 실제 등록/수정은 Smart-ERD가 권한, 범위, 필드, 정책을 검증하고 사용자가 preview/diff를 승인한 뒤 기존 서비스/API boundary를 통해 실행한다.

## Requirements

### AI Runtime Gateway

- [x] **AI-RUN-01**: 앱은 Local Codex runtime의 사용 가능 여부를 확인하고 사용자에게 상태를 표시할 수 있다.
- [x] **AI-RUN-02**: 시스템은 provider abstraction을 통해 AI provider를 호출하며, UI나 업무 로직이 Codex CLI에 직접 결합되지 않는다.
- [x] **AI-RUN-03**: Local Codex Adapter는 `codex exec`를 비대화식으로 실행하고 structured JSON output schema를 요청한다.
- [x] **AI-RUN-04**: Provider call은 timeout, cancellation, error mapping, retry 가능성 판단, output validation을 적용한다.
- [x] **AI-SEC-01**: Raw access token, session cookie, DB credential, arbitrary shell command는 model prompt나 model output 실행 경로에 노출되지 않는다.

### App Chat + Read Tools

- [x] **AI-CHAT-01**: 사용자는 앱 내 AI 챗봇에서 Smart-ERD 업무 질문을 입력하고 응답을 받을 수 있다.
- [x] **AI-CHAT-02**: 챗봇은 현재 team/project context를 명확히 사용하거나 사용자가 context를 선택할 수 있게 한다.
- [x] **AI-READ-01**: AI는 사업 개요와 프로젝트 요약 정보를 조회할 수 있다.
- [x] **AI-READ-02**: AI는 WBS와 마일스톤 정보를 조회할 수 있다.
- [x] **AI-READ-03**: AI는 이슈, 개인 TODO, WBS 작업 히스토리/댓글 정보를 조회할 수 있다.
- [x] **AI-READ-04**: 모든 read tool 호출은 기존 사용자, 팀, 프로젝트, 리소스 권한과 scope를 검증한다.

### Action Proposal + Approval

- [ ] **AI-ACT-01**: AI는 등록/수정 의도를 free-form text가 아니라 typed structured action proposal로 반환한다.
- [ ] **AI-APP-01**: 시스템은 action proposal을 실행 전 preview/diff로 보여준다.
- [ ] **AI-APP-02**: 사용자는 각 action proposal을 승인하거나 취소할 수 있으며, 승인 전에는 데이터가 변경되지 않는다.
- [ ] **AI-APP-03**: 승인된 write action만 기존 application service 또는 API boundary를 통해 실행된다.

### Audit + Safety

- [ ] **AI-AUD-01**: Prompt metadata, tool calls, action proposals, approval/cancel decision, execution result, error가 audit log에 기록된다.
- [ ] **AI-AUD-02**: Audit log와 provider log는 민감정보 redaction을 적용한다.
- [ ] **AI-AUD-03**: 사용자는 프로젝트별 AI 실행 이력과 결과를 조회할 수 있다.

### Low-Risk Write MVP

- [ ] **AI-WRITE-01**: 사용자는 AI가 제안한 issue create/update action을 승인해 실행할 수 있다.
- [ ] **AI-WRITE-02**: 사용자는 AI가 제안한 개인 TODO create/update action을 승인해 실행할 수 있다.
- [ ] **AI-WRITE-03**: 사용자는 AI가 제안한 WBS comment 또는 work memo add action을 승인해 실행할 수 있다.
- [ ] **AI-WRITE-04**: Delete, destructive, bulk destructive action은 v1.1에서 제안 또는 실행할 수 없다.
- [ ] **AI-WRITE-05**: Invalid, unauthorized, rejected action proposal은 프로젝트 데이터를 변경하지 않는다.

## Future Requirements

- **AI-FUTURE-01**: WBS 일정, 담당자, 진척률 수정 action을 승인 기반으로 지원한다.
- **AI-FUTURE-02**: 마일스톤 생성/수정 action을 승인 기반으로 지원한다.
- **AI-FUTURE-03**: 사업 개요, 보고서, 산출물, 요구사항 추적 매트릭스 문서화를 AI로 보조한다.
- **AI-FUTURE-04**: Hosted model provider와 API key 기반 provider를 추가한다.
- **AI-FUTURE-05**: 낮은 위험도의 반복 작업에 대해 프로젝트 정책 기반 자동 실행 옵션을 검토한다.
- **AI-FUTURE-06**: 외부 MCP/API integration으로 캘린더, 메신저, 문서 저장소와 연계한다.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Delete/destructive action | 사용자 승인 UI가 있어도 v1.1의 안전 경계를 넘는다 |
| Direct DB writes by AI | 권한, 불변식, audit를 우회한다 |
| Raw token exposure to model prompts | credential leakage 위험이 크다 |
| Arbitrary shell command execution by AI | Local Codex Adapter의 실행 권한과 업무 action 경계를 혼동시킨다 |
| Production shared-server Codex credential model | 멀티유저 credential 경계가 약해 별도 보안 설계가 필요하다 |
| SaaS-hosted AI runtime | v1.1은 로컬/Electron MVP를 먼저 검증한다 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-RUN-01 | Phase 9 | Complete |
| AI-RUN-02 | Phase 9 | Complete |
| AI-RUN-03 | Phase 9 | Complete |
| AI-RUN-04 | Phase 9 | Complete |
| AI-SEC-01 | Phase 9 | Complete |
| AI-CHAT-01 | Phase 10 | Complete |
| AI-CHAT-02 | Phase 10 | Complete |
| AI-READ-01 | Phase 10 | Complete |
| AI-READ-02 | Phase 10 | Complete |
| AI-READ-03 | Phase 10 | Complete |
| AI-READ-04 | Phase 10 | Complete |
| AI-ACT-01 | Phase 11 | Planned |
| AI-APP-01 | Phase 11 | Planned |
| AI-APP-02 | Phase 11 | Planned |
| AI-APP-03 | Phase 11 | Planned |
| AI-AUD-01 | Phase 11 | Planned |
| AI-AUD-02 | Phase 11 | Planned |
| AI-AUD-03 | Phase 11 | Planned |
| AI-WRITE-01 | Phase 12 | Planned |
| AI-WRITE-02 | Phase 12 | Planned |
| AI-WRITE-03 | Phase 12 | Planned |
| AI-WRITE-04 | Phase 12 | Planned |
| AI-WRITE-05 | Phase 12 | Planned |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0
