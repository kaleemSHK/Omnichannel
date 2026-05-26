/**
 * MOS (Mean Opinion Score) Voice Quality Scoring — Sprint 1 G03
 *
 * Implements the ITU-T E-model simplified formula to derive a MOS score
 * (range 1.0–4.5) from RTP statistics reported by JsSIP / WebRTC.
 *
 * Formula reference:
 *   R = 94.2 - Id - Ie_eff
 *   MOS = 1 + 0.035R + R(R-60)(100-R) × 7×10⁻⁶   (when R > 0)
 *
 * Where:
 *   Id     = delay impairment factor (derived from latency + jitter)
 *   Ie_eff = equipment impairment factor (derived from packet loss)
 *
 * Input: WebRTC RTCStatsReport fields (subset):
 *   { roundTripTimeMs, jitterMs, packetsLost, packetsSent, codec }
 *
 * Exported:
 *   computeMos(stats)          → number  (MOS 1.0–4.5)
 *   classifyMos(mos)           → MosGrade
 *   scoreFromRtpStats(stats)   → MosResult
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Baseline R factor (no impairment) */
const R_BASE = 94.2;

/** Mouth-to-ear latency headroom before delay factor kicks in (ms) */
const DELAY_OFFSET_MS = 177.3;

/** Codec impairment baseline (Ie) per codec name (ITU-T G.113 Table 1) */
const CODEC_IE = {
  // Narrowband codecs
  'PCMU': 0,    // G.711 μ-law
  'PCMA': 0,    // G.711 A-law
  'G711': 0,
  'G722': 5,    // wideband — slight impairment vs G.711
  'G729': 11,   // G.729 (8 kbps) — noticeable
  'G729A': 11,
  'G726': 7,
  'G723': 15,   // G.723.1 (6.3 kbps)
  // Wideband/Opus (modern WebRTC)
  'OPUS': 0,    // Opus at ≥32kbps ≈ transparent
  'opus': 0,
  // Video placeholder (not rated)
  'VP8': 0, 'VP9': 0, 'H264': 0,
};

const DEFAULT_CODEC_IE = 3; // Unknown codec — modest penalty

// ─── Core formula ─────────────────────────────────────────────────────────────

/**
 * Convert R-factor to MOS using ITU-T P.800.1 mapping.
 * Clamps output to [1.0, 4.5].
 */
function rToMos(R) {
  if (R <= 0) return 1.0;
  if (R >= 100) return 4.5;
  const mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  return Math.min(4.5, Math.max(1.0, Math.round(mos * 100) / 100));
}

/**
 * Compute MOS from raw RTP stats.
 *
 * @param {{
 *   roundTripTimeMs?: number,
 *   jitterMs?: number,
 *   packetsLost?: number,
 *   packetsSent?: number,
 *   packetsReceived?: number,
 *   codec?: string,
 * }} stats
 * @returns {number} MOS score 1.0–4.5
 */
function computeMos(stats = {}) {
  const rtt  = Math.max(0, stats.roundTripTimeMs ?? 0);
  const jitter = Math.max(0, stats.jitterMs ?? 0);
  const lost = Math.max(0, stats.packetsLost ?? 0);
  const sent = Math.max(1, (stats.packetsSent ?? 0) + (stats.packetsReceived ?? 0) + lost);
  const codec = String(stats.codec ?? 'opus').toUpperCase();

  // One-way delay estimate (RTT/2 + jitter buffer allowance)
  const oneWayDelayMs = rtt / 2 + jitter * 2;

  // Delay impairment (Id)
  let Id = 0;
  if (oneWayDelayMs > DELAY_OFFSET_MS) {
    const excess = oneWayDelayMs - DELAY_OFFSET_MS;
    Id = 0.024 * excess + 0.11 * (excess - 177.3) * (excess > 177.3 ? 1 : 0);
  }

  // Packet loss percentage
  const lossRate = lost / sent;

  // Codec baseline impairment
  const Ie = CODEC_IE[codec] ?? DEFAULT_CODEC_IE;

  // Effective equipment impairment including packet loss (Ie_eff)
  // Using simplified Bursty Loss model: Ie_eff = Ie + (95 - Ie) × (loss / (loss + BurstR))
  const BurstR = 8; // burst ratio assumption
  const Ie_eff = Ie + (95 - Ie) * (lossRate / (lossRate + BurstR / 100));

  const R = R_BASE - Id - Ie_eff;
  return rToMos(R);
}

// ─── MOS grade classification ─────────────────────────────────────────────────

/**
 * @typedef {'excellent'|'good'|'fair'|'poor'|'bad'} MosGrade
 */

/**
 * Classify a MOS score into a human-readable quality grade.
 * Based on ITU-T P.800 user satisfaction scale.
 *
 * @param {number} mos
 * @returns {{ grade: MosGrade, label: string, color: string }}
 */
function classifyMos(mos) {
  if (mos >= 4.3) return { grade: 'excellent', label: 'Excellent',  color: '#22c55e' }; // green-500
  if (mos >= 4.0) return { grade: 'good',      label: 'Good',       color: '#84cc16' }; // lime-500
  if (mos >= 3.6) return { grade: 'fair',       label: 'Fair',       color: '#eab308' }; // yellow-500
  if (mos >= 3.1) return { grade: 'poor',       label: 'Poor',       color: '#f97316' }; // orange-500
  return           { grade: 'bad',              label: 'Bad',        color: '#ef4444' }; // red-500
}

/**
 * Full scoring result with classification.
 *
 * @param {object} stats — see computeMos()
 * @returns {{
 *   mos: number,
 *   grade: MosGrade,
 *   label: string,
 *   color: string,
 *   inputs: object,
 * }}
 */
function scoreFromRtpStats(stats = {}) {
  const mos = computeMos(stats);
  const cls = classifyMos(mos);
  return {
    mos,
    ...cls,
    inputs: {
      roundTripTimeMs: stats.roundTripTimeMs ?? 0,
      jitterMs: stats.jitterMs ?? 0,
      packetsLost: stats.packetsLost ?? 0,
      packetsSent: stats.packetsSent ?? 0,
      packetsReceived: stats.packetsReceived ?? 0,
      codec: stats.codec ?? 'opus',
    },
  };
}

export { computeMos, classifyMos, scoreFromRtpStats };
