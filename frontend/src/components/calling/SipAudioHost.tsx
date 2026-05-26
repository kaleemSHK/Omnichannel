'use client';

import { useEffect } from 'react';
import { ensureSipAudioElements, unlockSipAudio } from '@/lib/telephony/sip-audio';

/** Mounts hidden remote-audio element and unlocks autoplay on first user gesture. */
export function SipAudioHost() {
  useEffect(() => {
    ensureSipAudioElements();
    const unlock = () => {
      void unlockSipAudio();
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  return (
    <audio
      id="__bn_sip_remote__"
      autoPlay
      playsInline
      className="hidden"
      aria-hidden
      tabIndex={-1}
    />
  );
}
