let RNHapticFeedback: { trigger: (type: string, opts?: object) => void } | null = null;

try {
  RNHapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  // Native module unavailable (emulator / missing native build)
}

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  try {
    const map = { light: 'impactLight', medium: 'impactMedium', heavy: 'impactHeavy' } as const;
    RNHapticFeedback?.trigger(map[style], options);
  } catch {}
}

export function hapticSelection() {
  try {
    RNHapticFeedback?.trigger('selection', options);
  } catch {}
}
