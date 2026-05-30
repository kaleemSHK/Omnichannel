/**
 * Local Whisper STT via faster-whisper ASR webservice (OpenAI-whisper-asr-webservice).
 * Free self-hosted — no GCP key required.
 */

const WHISPER_URL = (process.env.WHISPER_STT_URL || 'http://blinkone-whisper:9000').replace(
  /\/$/,
  '',
);
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'small';
const WHISPER_TIMEOUT_MS = parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10);

/** BCP-47 → ISO-639-1 (Whisper language code) */
function whisperLang(languageHint) {
  const hint = (languageHint || 'ar').trim();
  if (hint.length === 2) return hint;
  return hint.split('-')[0] || 'ar';
}

/**
 * Transcribe audio buffer (WAV/MP3/etc.) using local Whisper.
 * @param {Buffer} buffer
 * @param {string} [languageHint]
 */
export async function whisperTranscribe(buffer, languageHint) {
  const lang = whisperLang(languageHint);
  const params = new URLSearchParams({
    task: 'transcribe',
    language: lang,
    output: 'json',
    encode: 'true',
    word_timestamps: 'false',
  });

  const form = new FormData();
  form.append('audio_file', new Blob([buffer], { type: 'audio/wav' }), 'audio.wav');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${WHISPER_URL}/asr?${params}`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper ASR ${res.status}: ${errText.slice(0, 200)}`);
  }

  const body = await res.json();
  const transcript = String(body?.text ?? body?.transcription ?? '').trim();

  const segments = body?.segments ?? [];
  const words = segments.flatMap((seg) => {
    const text = String(seg?.text ?? '').trim();
    if (!text) return [];
    return [
      {
        word: text,
        start_time: Number(seg?.start ?? 0),
        end_time: Number(seg?.end ?? 0),
        speaker_tag: 0,
      },
    ];
  });

  return {
    transcript,
    detected_language: languageHint || lang,
    words,
    model: WHISPER_MODEL,
  };
}

export async function whisperHealthCheck() {
  try {
    const res = await fetch(`${WHISPER_URL}/`, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
