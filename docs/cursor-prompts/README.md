# BlinkOne — Cursor Prompt Library
**Last Updated:** 2026-05-26  
**Architect:** Claude Code

This directory contains structured, implementation-ready prompts for Cursor AI.  
Each prompt is self-contained with context, requirements, code specs, and validation steps.

---

## Usage Workflow

```
1. Open prompt file in Cursor
2. Read the "Context You Must Read First" section — open those files
3. Give Cursor the entire prompt as a single message
4. After implementation, run the Validation steps at the bottom
5. Run: cd frontend && npx tsc --noEmit
6. Send the review request back to Claude Code (me) for the Senior Code Review gate
```

---

## Sprint 1 — C3D Boost Track (Target: +6% C3D)

| # | File | Feature | Gap ID | Est. | Status |
|---|------|---------|--------|------|--------|
| 1 | [SPRINT1_PROMPT1_weighted_sbr.md](./SPRINT1_PROMPT1_weighted_sbr.md) | Weighted Skills-Based Routing | G01 | 3d | 🔲 TODO |
| 2 | [SPRINT1_PROMPT2_skills_manager_ui.md](./SPRINT1_PROMPT2_skills_manager_ui.md) | Skills Manager Admin UI | G04 | 2d | 🔲 TODO |
| 3 | [SPRINT1_PROMPT3_pci_recording_pause.md](./SPRINT1_PROMPT3_pci_recording_pause.md) | PCI Recording Pause Backend | G02 | 3d | 🔲 TODO |
| 4 | [SPRINT1_PROMPT4_mos_voice_quality.md](./SPRINT1_PROMPT4_mos_voice_quality.md) | MOS Voice Quality Scoring | G03 | 2d | 🔲 TODO |
| 5 | [SPRINT1_PROMPT5_pii_log_masking.md](./SPRINT1_PROMPT5_pii_log_masking.md) | PII Log Masking (all services) | G07 | 1d | 🔲 TODO |

**Sprint 1 total estimate: ~11 dev-days**  
**Sprint 1 C3D impact: +6.3% (Routing Accuracy +15%, Compliance +20%, Voice Quality tracking)**

---

## Sprint 2 — New Capabilities

| # | File | Feature | Gap ID | Est. | Status |
|---|------|---------|--------|------|--------|
| 1 | [SPRINT2_PROMPT1_predictive_dialer.md](./SPRINT2_PROMPT1_predictive_dialer.md) | Predictive Dialer Microservice | G05 | 8d | 🔲 TODO |

---

## Upcoming Prompts (Not Yet Written)

| Feature | Gap ID | Sprint |
|---------|--------|--------|
| CDR migrate to PostgreSQL | G06 | S1 |
| Zod input validation (all services) | G08 | S1 |
| Rate limiting at gateway | G11 | S2 |
| Speech analytics pipeline | G09 | S3 |
| Email threading | G10 | S3 |
| Chatwoot private labeling | G13 | S3 |
| WhatsApp IVR flow node | G14 | S3 |
| API key management | G19 | S3 |
| Webhook delivery + retry | G20 | S3 |
| Custom Dashboard Builder | G12 | S4 |
| SOC 2 audit logging | G16 | S4 |
| GDPR export/erasure | G17 | S4 |
| Agent gamification | G15 | S5 |

---

## Code Review Gate (Architect Review Checklist)

After each Cursor implementation, validate:

```
TypeScript:
  [ ] npx tsc --noEmit → zero errors

Code Quality:
  [ ] No console.log in production paths
  [ ] No TypeScript any
  [ ] Error states in all UI components (loading, error, empty)

Security:
  [ ] tenant_id filter on all DB queries
  [ ] Input validation (Zod) on new endpoints
  [ ] PII fields not exposed in API responses unnecessarily

Architecture:
  [ ] API calls go through lib/api/*.ts (not inline fetch)
  [ ] Server state via React Query (not Zustand)
  [ ] New types in types/index.ts
  [ ] Components in correct domain folder

Documentation:
  [ ] New env vars in .env.example
  [ ] New services in docker-compose.yml
  [ ] Architecture doc updated if major changes
```

---

## Architecture Reference

Full architecture document: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)

Key sections:
- §2 — Service contract standards (API shape, auth, multi-tenancy)
- §3 — Module-by-module architecture (what to build, data models)
- §5 — Security requirements
- §6 — Frontend architecture standards
- §8 — Gap analysis priority matrix
- §9 — Code review gates
- §10 — C3D scoring roadmap
