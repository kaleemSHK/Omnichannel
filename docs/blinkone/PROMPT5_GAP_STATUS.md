# Prompt 5 — gap closure status

Last updated after gap-closure pass.

| Item | Status |
|------|--------|
| Overflow TR-15 (`max_depth`, `max_wait_sec`) | Done — `lib/overflow.js` |
| Postgres `call_sessions` / `recording_objects` | Done — `services/calls/db/` |
| PowerShell smoke tests | Done — `scripts/test-routing.ps1` |
| Selection unit tests | Done — `services/routing/test/selection.test.js` |
| Supervisor tenant 403 | Done — `FORBIDDEN` on mismatch |
| Reports AHT / abandonment summary | Partial — avg handle + abandonment rate |
| SIPp scenario file | Scaffold — `tests/sipp/inbound-call.xml` |
| NestJS migration | Not started |
| MinIO recording worker | Not started |
| WebSocket realtime push | Not started (HTTP poll in UI) |
| Floating PhonePanel + JsSIP + screen-pop | Not started |
| `blinkone.telephony.enabled` flag | Not started |
| fast-check property tests | Not started (node:test coverage added) |
| CI telephony + SIPp job | Not started |

## Rebuild after changes

```powershell
docker compose build routing calls
docker compose up -d routing calls
.\scripts\test-routing.ps1
```
