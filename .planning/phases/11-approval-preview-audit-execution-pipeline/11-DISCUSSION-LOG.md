# Phase 11: Approval Preview + Audit Execution Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-04T03:12:27Z
**Phase:** 11-Approval Preview + Audit Execution Pipeline
**Areas discussed:** Proposal display flow, Preview/diff depth, Approval execution state, Audit/history storage

---

## Proposal Display Flow

### First display location

| Option | Description | Selected |
|--------|-------------|----------|
| Answer-embedded cards | Show proposals inside the AI answer where the context already exists. | ✓ |
| Separate review panel | Separate pending approvals into a dedicated surface. | |
| Both answer and review panel | Show inline and also maintain a separate queue. | |

**User's choice:** Answer-embedded cards.
**Notes:** The user selected option 1, then asked to proceed with the agent's recommended options for all remaining decisions.

### Multiple proposals

| Option | Description | Selected |
|--------|-------------|----------|
| Individual cards and individual approval | Each proposal has its own approve/cancel controls. | ✓ |
| Bundle approval | Approve or cancel all proposals together. | |
| Sequential review | Step through proposals one at a time. | |

**User's choice:** Individual cards and individual approval.
**Notes:** Selected directly by the user.

### Card contents

| Option | Description | Selected |
|--------|-------------|----------|
| Summary, target, changed fields, risk level | Shows enough to judge approval without raw payload exposure. | ✓ |
| Summary and target only | Simpler but hides important change detail. | |
| Full JSON/raw payload | Useful for debugging but too noisy and risky for users. | |

**User's choice:** Summary, target, changed fields, risk level.
**Notes:** Selected directly by the user.

### Card lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in chat message | Leave processed cards in their original answer with final status. | ✓ |
| Collapse after decision | Keep the record but reduce visual footprint. | |
| Remove after decision | Simplest UI but weak traceability. | |

**User's choice:** Agent recommended option.
**Notes:** Locked as keep-in-message after the user asked to use recommended options for the rest.

---

## Preview/Diff Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Server-generated field-level preview | Backend loads authoritative state and returns before/after or proposed fields. | ✓ |
| Summary-only preview | Fast to implement but weak approval confidence. | |
| Frontend-computed diff | Keeps backend smaller but trusts browser/provider-shaped data too much. | |

**User's choice:** Agent recommended option.
**Notes:** Locked as server-generated preview. Updates show field-level before/after; creates show proposed/defaulted values; comment/memo proposals show target path and content.

---

## Approval Execution State

| Option | Description | Selected |
|--------|-------------|----------|
| Persist pending proposals | Server owns pending/approved/cancelled/expired/failed lifecycle. | ✓ |
| Browser-only approval state | Smaller but unsafe across refresh/session/server restart. | |
| Existing execution status only | Avoids a new entity but cannot model proposal-level decisions well. | |

**User's choice:** Agent recommended option.
**Notes:** Locked as persisted server proposal lifecycle. Approve/cancel endpoints operate on proposal ids, revalidate immediately before execution, and terminal states are immutable.

---

## Audit/History Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Redacted project AI history | Store metadata, sanitized proposal/preview/decision/result, and show project-scoped history. | ✓ |
| Metadata-only invisible audit | Safe but less useful for users. | |
| Full transcript/raw audit | Rich but violates the redaction principle. | |

**User's choice:** Agent recommended option.
**Notes:** Locked as redacted project AI history. Private TODO proposal/audit detail remains owner/requester-visible unless linked into project-visible WBS context.

---

## the agent's Discretion

- The user explicitly said to use the agent's recommended options after the first three proposal-flow choices.
- The planner may choose exact DTO, entity, endpoint, and component names.
- The planner may choose exact visual composition for proposal cards as long as they appear inside the originating AI answer.

## Deferred Ideas

- Concrete low-risk action executors are deferred to Phase 12.
- Delete, destructive, and bulk destructive actions remain outside v1.1.
- Hosted providers, provider credential UI, and full server-stored chat transcript history remain future work.
