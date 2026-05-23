# Performance baseline (Prompt 11)

Record k6 results after running `tests/load/` against staging hardware.

## Environment

| Field | Value |
|-------|--------|
| Date | _YYYY-MM-DD_ |
| Host | _e.g. 8 vCPU / 32 GB RAM_ |
| Compose profile | default |

## TR-61 / TR-62 — Routing

**Script:** `tests/load/routing-load.js`

| Metric | Target | Measured |
|--------|--------|----------|
| p95 latency | < 100 ms | _TBD_ |
| Error rate | < 1% | _TBD_ |
| VUs | 50 (adjust to 500 agents scenario) | |

## Gateway (5K RPS goal)

**Script:** `tests/load/gateway-load.js`

| Metric | Target | Measured |
|--------|--------|----------|
| Error rate | < 0.1% | _TBD_ |
| Peak RPS | 5000 | _TBD_ |

## AI — voice / STT proxy

**Script:** `tests/load/ai-health-load.js` (health); full STT load requires seeded Piper/Google.

| Metric | Target | Measured |
|--------|--------|----------|
| p95 | < 800 ms | _TBD_ |

## SLA — 100K conversations

**Script:** `tests/load/sla-load.js` + DB seed script (TODO: `scripts/seed-sla-bulk.mjs`).

| Metric | Target | Measured |
|--------|--------|----------|
| Breach detection window | ≤ 30 s | _TBD_ |

## Notes

- Tune `K6_VUS`, `K6_DURATION` env vars for repeatable runs.
- Export k6 summary: `k6 run --out json=results.json tests/load/routing-load.js`
