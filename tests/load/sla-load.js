/**
 * SLA dashboard under load (breach worker runs on 30s interval in service).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.SLA_URL || 'http://127.0.0.1:8796';
const TOKEN = __ENV.SLA_TOKEN || 'sla-api-token';
const TENANT = __ENV.SLA_TENANT || '1';

export const options = {
  vus: 20,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(`${BASE}/v1/dashboard?tenant_id=${TENANT}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'X-Blinkone-Tenant-Id': TENANT },
  });
  check(res, { ok: (r) => r.status === 200 });
  sleep(0.5);
}
