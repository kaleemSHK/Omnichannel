# BlinkOne v1.0 — Handover acceptance checklist

**Customer:** LABBIK · **Vendor:** _Your company_ · **Date:** ___________

Sign when each item is verified on the agreed staging/production environment.

## A. Software delivery

- [ ] Source repository access (or git bundle at tag `v1.0.0`)
- [ ] `BlinkOne-Deliverables-v1.0/` package received
- [ ] `THIRD_PARTY_LICENSES.md` reviewed
- [ ] No Chatwoot Enterprise code in tree (pre-commit audit passed)

## B. Functional acceptance

- [ ] `acceptance-report.html` reviewed — critical TRs PASS or accepted waivers documented
- [ ] TR-29 Arabic voice / RAG demonstrated (or waiver)
- [ ] TR-37–41 multi-tenant isolation demonstrated
- [ ] TR-49 SSO configuration demonstrated
- [ ] TR-55 encryption at rest verified (or waiver with timeline)
- [ ] TR-67 KPI / realtime dashboard reviewed

## C. Performance & security

- [ ] `PERFORMANCE_BASELINE.md` filled for target hardware
- [ ] `SECURITY_REVIEW.md` findings closed or accepted
- [ ] Production secrets in vault (not `.env` in repo)

## D. Documentation & operations

- [ ] Technical docs site built (`mkdocs build`)
- [ ] Deployment guide ([deploy/on-prem.md](./deploy/on-prem.md)) executed once by LABBIK
- [ ] Runbooks acknowledged by ops
- [ ] KT plan Weeks 1–4 scheduled

## E. Commercial

- [ ] `BlinkOne-Commercial-Proposal.md` executed or superseded by contract

---

**LABBIK authorized signatory:** _________________________ **Date:** _________

**Vendor signatory:** _________________________ **Date:** _________

**Waivers / notes:**
