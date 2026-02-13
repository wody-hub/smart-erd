import { runWebSocketSession } from './websocket-common.js';

export const options = {
    scenarios: {
        websocket_soak: {
            executor: 'constant-vus',
            vus: Number(__ENV.SOAK_VUS || '30'),
            duration: __ENV.SOAK_DURATION || '25m',
            gracefulStop: __ENV.SOAK_GRACEFUL_STOP || '30s',
        },
    },
    thresholds: {
        ws_connect_ok: ['rate>0.97'],
        ticket_issue_ok: ['rate>0.97'],
        http_req_failed: ['rate<0.03'],
        ws_session_duration_ms: ['p(95)<20000'],
    },
};

export default function () {
    runWebSocketSession();
}
