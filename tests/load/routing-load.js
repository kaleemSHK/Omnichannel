/**
 * TR-61 / TR-62 — routing decision latency under load.
 * Target: p95 < 100ms, 10 VUs, queue stats endpoint as proxy.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.ROUTING_URL || 'http://127.0.0.1:8798';
const TOKEN = __ENV.ROUTING_TOKEN || 'routing-api-token';
const TENANT = __ENV.ROUTING_TENANT || '1';

export const options = {
  vus: Number(__ENV.K6_VUS || 50),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<100'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE}/v1/dashboards/realtime?tenant_id=${TENANT}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'X-Blinkone-Tenant-Id': TENANT },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1);
}
