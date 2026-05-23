# Prompt 11 — Verification, documentation, handover

## Status

Deliverables scaffolded for LABBIK sign-off (TR-68–73, TRD Section 18–19).

## 1. Acceptance gauntlet

```powershell
# Stack running + optional full DB tests
$env:RUN_ACCEPTANCE="1"
node tests/acceptance/runner.mjs
# Open tests/acceptance/artifacts/acceptance-report.html
```

| TR | Test module |
|----|-------------|
| TR-29 | `tests/tr-29-arabic-voice-bot.mjs` |
| TR-37–38 | `tests/tr-37-41-multi-tenant.mjs` + `cross-tenant-gauntlet` |
| TR-49 | `tests/tr-49-sso.mjs` |
| TR-55 | `tests/tr-55-encryption.mjs` (`RUN_ENCRYPTION_TEST=1`) |
| TR-58 | `tests/tr-58-mfa.mjs` |
| TR-67 | `tests/tr-67-kpis.mjs` |
| TR-70 | `tests/tr-handover.mjs` |

Extend `tests/acceptance/tr-matrix.json` for full TR coverage.

## 2. Performance (k6)

See `tests/load/README.md` → record in `PERFORMANCE_BASELINE.md`.

## 3. Security

- `node scripts/blinkone/security-audit.mjs`
- Checklist: `SECURITY_REVIEW.md`

## 4. Documentation site

```bash
pip install mkdocs mkdocs-material
mkdocs build -f mkdocs.yml
```

## 5. Handover package

`BlinkOne-Deliverables-v1.0/README.md` indexes all artifacts.

## 6. Sign-off

`HANDOVER_CHECKLIST.md` + `KT_PLAN.md` + `BlinkOne-Commercial-Proposal.md`

## Playwright (optional next step)

Add `@playwright/test` under `tests/acceptance/e2e/` for dashboard login flows when staging URL is stable.
