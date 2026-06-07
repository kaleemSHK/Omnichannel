/** Fired after a call ends so workspace/history refetch tenant CDR. */
export const CALL_HISTORY_INVALIDATE = 'blinkone:call-history-invalidate';

export function notifyCallHistoryChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CALL_HISTORY_INVALIDATE));
}
