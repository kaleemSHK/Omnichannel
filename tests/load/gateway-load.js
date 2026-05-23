/**
 * Gateway sustained RPS — target error rate < 0.1%.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.GATEWAY_URL || 'http://127.0.0.1:8787';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const res = http.get(`${BASE}/health`);
  check(res, { ok: (r) => r.status === 200 });
  sleep(0.01);
}
