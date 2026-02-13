import { runWebSocketSession } from './websocket-common.js';

export const options = {
    scenarios: {
        websocket_load: {
            executor: 'ramping-vus',
            startVUs: Number(__ENV.START_VUS || '5'),
            stages: [
                {
                    duration: __ENV.STAGE1_DURATION || '30s',
                    target: Number(__ENV.STAGE1_TARGET || '30'),
                },
                {
                    duration: __ENV.STAGE2_DURATION || '60s',
                    target: Number(__ENV.STAGE2_TARGET || '60'),
                },
                {
                    duration: __ENV.STAGE3_DURATION || '30s',
                    target: Number(__ENV.STAGE3_TARGET || '0'),
                },
            ],
            gracefulRampDown: __ENV.GRACEFUL_RAMP_DOWN || '30s',
        },
    },
    thresholds: {
        ws_connect_ok: ['rate>0.95'],
        ticket_issue_ok: ['rate>0.95'],
        http_req_failed: ['rate<0.05'],
    },
};

export default function () {
    runWebSocketSession();
}
