/**
 * AI service health under concurrent voice-session proxy load.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.AI_URL || 'http://127.0.0.1:8793';
const TOKEN = __ENV.AI_TOKEN || 'ai-api-token';

export const options = {
  vus: Number(__ENV.K6_VUS || 50),
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const res = http.get(`${BASE}/v1/health`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { ok: (r) => r.status === 200 });
  sleep(0.2);
}
