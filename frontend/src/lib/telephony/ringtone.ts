/**
 * Browser ringtone for incoming calls (UI layer — independent of SIP early media).
 * Uses Web Audio so no asset file is required.
 */

let ctx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;
let ringOscillators: OscillatorNode[] = [];
let active = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

async function resumeCtx(): Promise<void> {
  const ac = getCtx();
  if (ac.state === 'suspended') await ac.resume();
}

function playRingBurst(): void {
  const ac = getCtx();
  const t = ac.currentTime;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  gain.connect(ac.destination);

  for (const freq of [440, 480]) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.95);
    ringOscillators.push(osc);
  }
  ringOscillators = ringOscillators.filter(o => {
    o.onended = () => {};
    return true;
  });
}

export async function startIncomingRingtone(): Promise<void> {
  if (active || typeof window === 'undefined') return;
  active = true;
  try {
    await resumeCtx();
    playRingBurst();
    ringInterval = setInterval(() => {
      if (!active) return;
      void playRingBurst();
    }, 2000);
  } catch (err) {
    console.warn('[ringtone] failed to start', err);
    active = false;
  }
}

export function stopIncomingRingtone(): void {
  active = false;
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  for (const o of ringOscillators) {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
  }
  ringOscillators = [];
}
