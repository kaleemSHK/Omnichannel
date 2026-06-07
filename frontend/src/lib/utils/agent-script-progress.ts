const PREFIX = 'blinkone:agent-script:';

function storageKey(conversationId: number) {
  return `${PREFIX}${conversationId}`;
}

export function readAgentScriptProgress(conversationId: number): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(storageKey(conversationId));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function writeAgentScriptProgress(
  conversationId: number,
  progress: Record<string, boolean>,
) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(conversationId), JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

export function stableStepId(step: { id?: string }, index: number): string {
  const id = String(step.id ?? '').trim();
  return id || `step-${index + 1}`;
}

export function scriptStepsFingerprint(
  steps: { id?: string; label?: string; description?: string }[],
): string {
  return steps
    .map((s, i) => `${stableStepId(s, i)}|${s.label ?? ''}|${s.description ?? ''}`)
    .join('\n');
}
