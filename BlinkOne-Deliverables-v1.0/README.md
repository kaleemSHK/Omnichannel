# BlinkOne Deliverables v1.0 (TRD Section 18)

Package index for LABBIK handover. Physical layout mirrors the git repository at release tag **`v1.0.0`** (create tag at sign-off).

## Contents

| Item | Location |
|------|----------|
| **Source code** | Repository root (or `git bundle create blinkone-v1.bundle --all`) |
| **Third-party licenses** | [../THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md) |
| **Technical documentation** | [../docs/blinkone/](../docs/blinkone/) — build HTML: `mkdocs build -f mkdocs.yml` |
| **API documentation** | Integration `/blinkone/api/docs` + per-service `openapi.yaml` |
| **Architecture** | [../docs/blinkone/ARCHITECTURE.md](../docs/blinkone/ARCHITECTURE.md) |
| **Deployment guides** | [../docs/blinkone/deploy/](../docs/blinkone/deploy/) |
| **Runbooks** | [../docs/blinkone/runbooks/](../docs/blinkone/runbooks/) |
| **Training** | [../docs/blinkone/training/](../docs/blinkone/training/) |
| **Acceptance report** | Run `RUN_ACCEPTANCE=1 node tests/acceptance/runner.mjs` → `tests/acceptance/artifacts/acceptance-report.html` |
| **Performance baseline** | [../docs/blinkone/PERFORMANCE_BASELINE.md](../docs/blinkone/PERFORMANCE_BASELINE.md) |
| **Security review** | [../docs/blinkone/SECURITY_REVIEW.md](../docs/blinkone/SECURITY_REVIEW.md) |
| **KT plan** | [../docs/blinkone/KT_PLAN.md](../docs/blinkone/KT_PLAN.md) |
| **Commercial proposal** | [../BlinkOne-Commercial-Proposal.md](../BlinkOne-Commercial-Proposal.md) |
| **Sign-off checklist** | [../docs/blinkone/HANDOVER_CHECKLIST.md](../docs/blinkone/HANDOVER_CHECKLIST.md) |

## Quick verify

```powershell
docker compose up -d
RUN_ACCEPTANCE=1 node tests/acceptance/runner.mjs
start tests/acceptance/artifacts/acceptance-report.html
```

## Contact

Vendor engineering: _[fill]_ · LABBIK project lead: _[fill]_
