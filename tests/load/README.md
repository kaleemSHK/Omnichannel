# BlinkOne load tests (k6)

Requires [k6](https://k6.io/docs/get-started/installation/).

```powershell
$env:ROUTING_URL="http://127.0.0.1:8798"
$env:ROUTING_TOKEN="routing-api-token"
k6 run tests/load/routing-load.js
k6 run tests/load/gateway-load.js
k6 run tests/load/ai-health-load.js
```

Record results in `docs/blinkone/PERFORMANCE_BASELINE.md`.
