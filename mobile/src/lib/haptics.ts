import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  const map = { light: 'impactLight', medium: 'impactMedium', heavy: 'impactHeavy' } as const;
  ReactNativeHapticFeedback.trigger(map[style], options);
}

export function hapticSelection() {
  ReactNativeHapticFeedback.trigger('selection', options);
}
