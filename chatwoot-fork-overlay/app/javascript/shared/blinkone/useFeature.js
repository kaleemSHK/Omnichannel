import { computed } from 'vue';
import { useBlinkoneApi } from './useBlinkoneApi';

function normalizeEnabled(val) {
  if (val === false) return false;
  if (val === true) return true;
  if (val && typeof val === 'object' && 'enabled' in val) return val.enabled !== false;
  return !!val;
}

/**
 * Plan + per-tenant feature gate (reads tenant features from useBlinkoneApi).
 * @param {string} key — e.g. 'sla', 'calling.pstn', 'agent_assist'
 */
export function useFeature(key) {
  const { features, loadFeatures } = useBlinkoneApi();

  const enabled = computed(() => {
    const f = features.value;
    if (key === 'calling.pstn') {
      const pstn = f['calling.pstn'] ?? f.telephony;
      return normalizeEnabled(pstn);
    }
    if (key === 'telephony') {
      const t = f.telephony ?? f['calling.pstn'];
      return normalizeEnabled(t);
    }
    return normalizeEnabled(f[key]);
  });

  return { enabled, loadFeatures };
}
