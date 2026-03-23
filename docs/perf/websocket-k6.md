# WebSocket k6 Load/Soak Guide

## Purpose
- Validate WebSocket collaboration stability under sustained concurrent sessions.
- Exercise real flow: `POST /api/ws-ticket` -> `GET /ws/diagram/{diagramId}?ticket=...`.

## Prerequisites
- Server is running (example: `http://localhost:9500`).
- `k6` is installed.
- Test users exist and each user has a valid JWT access token.
- `BEARER_TOKENS` must include enough unique users for your target concurrency.
  - Reason: `smart-erd.websocket.max-connections-per-user` default is `5`.
- For long soak runs, increase JWT access token TTL.
  - Example: `SMART_ERD_JWT_ACCESS_EXPIRATION=7200000` (2h)
  - Start server with override: `SMART_ERD_JWT_ACCESS_EXPIRATION=7200000 ./gradlew bootRun`

## Scripts
- Load profile: `scripts/perf/k6/websocket-load.js`
- Soak profile: `scripts/perf/k6/websocket-soak.js`
- Shared logic: `scripts/perf/k6/websocket-common.js`

## Quick Start
```bash
export BEARER_TOKENS='token_user1,token_user2,token_user3,token_user4,token_user5,token_user6'
export DIAGRAM_ID=1
export BASE_HTTP_URL='http://localhost:9500'
export SESSION_DURATION_MS=30000
export ITERATION_PAUSE_MS=200

k6 run scripts/perf/k6/websocket-load.js
```

Soak:
```bash
export BEARER_TOKENS='token_user1,token_user2,token_user3,token_user4,token_user5,token_user6'
export DIAGRAM_ID=1
export BASE_HTTP_URL='http://localhost:9500'
export SOAK_VUS=30
export SOAK_DURATION='25m'
export SESSION_DURATION_MS=30000
export ITERATION_PAUSE_MS=200

k6 run scripts/perf/k6/websocket-soak.js
```

## Important Environment Variables
- `BASE_HTTP_URL` (default: `http://localhost:9500`)
- `BASE_WS_URL` (optional; auto-derived from `BASE_HTTP_URL` if omitted)
- `TICKET_PATH` (default: `/api/ws-ticket`)
- `DIAGRAM_ID` (default: `1`)
- `BEARER_TOKENS` (comma-separated JWT list, required)
- `MESSAGE_TYPE` (default: `1`, `MSG_SYNC_STEP1`)
- `MESSAGE_PAYLOAD_BYTES` (default: `16`)
- `SEND_INTERVAL_MS` (default: `500`)
- `SESSION_DURATION_MS` (default: `30000`)
- `ITERATION_PAUSE_MS` (default: `200`)
- `TICKET_MAX_RETRIES` (default: `2`)
- `TICKET_RETRY_BACKOFF_MS` (default: `250`)
- `TICKET_RETRY_JITTER_MS` (default: `100`)
- `TICKET_FAILURE_BACKOFF_MS` (default: `1000`)

Load-stage controls:
- `START_VUS` (default: `5`)
- `STAGE1_DURATION` (default: `30s`)
- `STAGE1_TARGET` (default: `30`)
- `STAGE2_DURATION` (default: `60s`)
- `STAGE2_TARGET` (default: `60`)
- `STAGE3_DURATION` (default: `30s`)
- `STAGE3_TARGET` (default: `0`)

Soak controls:
- `SOAK_VUS` (default: `30`)
- `SOAK_DURATION` (default: `25m`)

## Metrics to Watch
- `ws_connect_ok` (handshake success rate)
- `ticket_issue_ok` (ticket issuance success rate)
- `ws_connect_failures`
- `ws_messages_sent`
- `ws_binary_messages_received`
- `ws_relay_received` (session-level relay observation)
- `ws_session_duration_ms`

## Interpretation Notes
- Low `ws_connect_ok` with high `ticket_issue_ok` often means WS handshake/path/ticket reuse issues.
- Low `ticket_issue_ok` usually means auth token problems or API throttling/errors.
- If target VUs exceed user/token capacity, you may see many session closes due to connection limits.
