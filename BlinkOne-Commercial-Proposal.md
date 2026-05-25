# BlinkOne — Commercial proposal (draft)

**Prepared for:** LABBIK Telecom · **Version:** 1.0 draft · **Date:** May 2026

> Confirm licensing and ownership clauses with legal before execution.

## 1. Licensing

| Component | License | Notes |
|-----------|---------|-------|
| BlinkOne sidecars, gateway, overlay, docs | **MIT** (proposed) | Full source delivered to LABBIK |
| Chatwoot CE base | **MIT** (upstream) | Pinned `v4.13.0-ce` — no Enterprise modules |
| Third-party dependencies | Per `THIRD_PARTY_LICENSES.md` | npm/pnpm packages |

**Explicit exclusion:** No Chatwoot Enterprise (`enterprise/`) features, code, or entitlements are included in this delivery.

## 2. Source code ownership

**Option A (recommended):** Full ownership transfer to LABBIK upon final payment — all copyrights in custom BlinkOne work product assign to LABBIK.

**Option B:** Perpetual, irrevocable, unlimited-modification license to LABBIK; vendor retains background IP in pre-existing tools.

_Confirm with LABBIK legal._

## 3. Implementation investment

| Phase | Scope | Indicative (OMR) |
|-------|-------|------------------|
| Foundation (Prompts 1–4) | Compose, gateway, shared packages | _[fill]_ |
| Telephony (5–6) | SIP, routing, SLA, escalation | _[fill]_ |
| AI & tenant (7–8) | Voice bot, RAG, multi-tenant | _[fill]_ |
| Billing & integration (9–10) | OMR billing, SSO, webhooks | _[fill]_ |
| Verification & handover (11) | Acceptance, docs, KT | _[fill]_ |
| **Total** | | _[fill]_ |

## 4. Support tiers

| Tier | Hours | SLA response | Includes |
|------|-------|--------------|----------|
| **Bronze** | 8 h/mo | 2 business days | Security patches, advisory |
| **Silver** | 24 h/mo | 1 business day | + bug fixes, quarterly CE merge support |
| **Gold** | 60 h/mo | 4 h critical | + phone bridge, dedicated Slack |

## 5. AI economics

- Tenants are billed by LABBIK (usage metering via billing sidecar).
- LABBIK pays underlying providers (OpenAI, Google STT, Piper hosting) at cost + agreed markup.
- Transparent pass-through on invoice lines (`ai_token`, `stt_minute`, `tts_char`).

## 6. Maintenance & upgrades

- **Security patches:** within 72 hours of CVE disclosure affecting BlinkOne stack.
- **Chatwoot upstream:** quarterly merge from CE release branch (see `deploy/upgrade.md`).
- **Major features:** change request / SOW outside support hours.

---

**Acceptance:** Handover per [docs/blinkone/HANDOVER_CHECKLIST.md](docs/blinkone/HANDOVER_CHECKLIST.md).
