import exec from 'k6/execution';
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const wsConnectOk = new Rate('ws_connect_ok');
export const ticketIssueOk = new Rate('ticket_issue_ok');
export const wsRelayReceived = new Rate('ws_relay_received');

export const wsConnectFailures = new Counter('ws_connect_failures');
export const ticketIssueFailures = new Counter('ticket_issue_failures');
export const wsMessagesSent = new Counter('ws_messages_sent');
export const wsBinaryMessagesReceived = new Counter('ws_binary_messages_received');
export const wsSessionsClosed = new Counter('ws_sessions_closed');

export const wsSessionDuration = new Trend('ws_session_duration_ms');

function toPositiveInt(value, fallback, min) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.floor(parsed));
}

function parseCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
}

function toWsUrl(baseUrl) {
    if (baseUrl.startsWith('https://')) {
        return `wss://${baseUrl.slice('https://'.length)}`;
    }
    if (baseUrl.startsWith('http://')) {
        return `ws://${baseUrl.slice('http://'.length)}`;
    }
    return baseUrl;
}

export function loadConfig() {
    const baseHttpUrl = __ENV.BASE_HTTP_URL || 'http://localhost:9503';
    const baseWsUrl = __ENV.BASE_WS_URL || toWsUrl(baseHttpUrl);
    const ticketPath = __ENV.TICKET_PATH || '/api/ws-ticket';

    const cfg = {
        baseHttpUrl,
        baseWsUrl,
        ticketPath,
        diagramId: Number(__ENV.DIAGRAM_ID || '1'),
        bearerTokens: parseCsv(__ENV.BEARER_TOKENS),
        messageType: toPositiveInt(__ENV.MESSAGE_TYPE || '1', 1, 1) & 0xff,
        messagePayloadBytes: toPositiveInt(__ENV.MESSAGE_PAYLOAD_BYTES || '16', 16, 1),
        sendIntervalMs: toPositiveInt(__ENV.SEND_INTERVAL_MS || '500', 500, 1),
        sessionDurationMs: toPositiveInt(__ENV.SESSION_DURATION_MS || '30000', 30000, 100),
        iterationPauseMs: toPositiveInt(__ENV.ITERATION_PAUSE_MS || '200', 200, 0),
        ticketMaxRetries: toPositiveInt(__ENV.TICKET_MAX_RETRIES || '2', 2, 0),
        ticketRetryBackoffMs: toPositiveInt(__ENV.TICKET_RETRY_BACKOFF_MS || '250', 250, 1),
        ticketRetryJitterMs: toPositiveInt(__ENV.TICKET_RETRY_JITTER_MS || '100', 100, 0),
        ticketFailureBackoffMs: toPositiveInt(__ENV.TICKET_FAILURE_BACKOFF_MS || '1000', 1000, 1),
    };

    if (cfg.bearerTokens.length === 0) {
        throw new Error('BEARER_TOKENS 환경변수가 비어 있습니다. 최소 1개 JWT가 필요합니다.');
    }
    return cfg;
}

function pickToken(tokens) {
    const vu = exec.vu.idInTest;
    const iter = exec.vu.iterationInScenario;
    const idx = (vu + iter) % tokens.length;
    return tokens[idx];
}

function issueTicketOnce(cfg) {
    const token = pickToken(cfg.bearerTokens);
    const res = http.post(
        `${cfg.baseHttpUrl}${cfg.ticketPath}`,
        JSON.stringify({ diagramId: cfg.diagramId }),
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const ok = check(res, {
        'ticket issue status is 200': (r) => r.status === 200,
    });
    ticketIssueOk.add(ok);
    if (!ok) {
        ticketIssueFailures.add(1);
        return null;
    }

    const json = res.json();
    if (!json || !json.ticket) {
        ticketIssueOk.add(false);
        ticketIssueFailures.add(1);
        return null;
    }
    return { ticket: json.ticket, status: res.status };
}

function issueTicketWithRetry(cfg) {
    const maxAttempts = cfg.ticketMaxRetries + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const result = issueTicketOnce(cfg);
        if (result && result.ticket) {
            return result.ticket;
        }
        if (attempt < maxAttempts - 1) {
            const jitter = cfg.ticketRetryJitterMs > 0 ? Math.floor(Math.random() * cfg.ticketRetryJitterMs) : 0;
            const waitMs = cfg.ticketRetryBackoffMs + jitter;
            sleep(waitMs / 1000);
        }
    }
    return null;
}

function buildMessage(messageType, bodyBytes) {
    const payload = new Uint8Array(bodyBytes + 1);
    payload[0] = messageType;
    for (let i = 1; i < payload.length; i += 1) {
        payload[i] = (i * 31 + messageType) & 0xff;
    }
    return payload.buffer;
}

function firstByte(data) {
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data)[0];
    }
    if (typeof data === 'string') {
        return data.length > 0 ? data.charCodeAt(0) & 0xff : -1;
    }
    return -1;
}

export function runWebSocketSession() {
    const cfg = loadConfig();
    const ticket = issueTicketWithRetry(cfg);
    if (!ticket) {
        sleep(cfg.ticketFailureBackoffMs / 1000);
        return;
    }

    const wsUrl = `${cfg.baseWsUrl}/ws/diagram/${cfg.diagramId}?ticket=${ticket}`;
    const messagePayload = buildMessage(cfg.messageType, cfg.messagePayloadBytes);

    let relayObserved = false;
    let openedAt = 0;
    let intervalId = null;

    const res = ws.connect(wsUrl, { headers: { Origin: 'http://localhost:4503' } }, (socket) => {
        socket.on('open', () => {
            openedAt = Date.now();
            intervalId = socket.setInterval(() => {
                socket.sendBinary(messagePayload);
                wsMessagesSent.add(1);
            }, cfg.sendIntervalMs);
            socket.setTimeout(() => socket.close(), cfg.sessionDurationMs);
        });

        socket.on('binaryMessage', (data) => {
            wsBinaryMessagesReceived.add(1);
            if (firstByte(data) === cfg.messageType) {
                relayObserved = true;
            }
        });

        socket.on('close', () => {
            wsSessionsClosed.add(1);
            intervalId = null;
            if (openedAt > 0) {
                wsSessionDuration.add(Date.now() - openedAt);
            }
            wsRelayReceived.add(relayObserved);
        });

        socket.on('error', () => {
            wsConnectFailures.add(1);
        });
    });

    const connected = check(res, {
        'ws handshake status is 101': (r) => r && r.status === 101,
    });
    wsConnectOk.add(connected);
    if (!connected) {
        wsConnectFailures.add(1);
    }
    if (cfg.iterationPauseMs > 0) {
        sleep(cfg.iterationPauseMs / 1000);
    }
}
