import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { C } from '@/lib/ui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, object> = {
  primary: { backgroundColor: C.brand },
  secondary: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: C.red },
};

const TEXT_STYLES: Record<Variant, object> = {
  primary: { color: C.textWhite, fontWeight: '700' },
  secondary: { color: C.text, fontWeight: '500' },
  ghost: { color: C.brand, fontWeight: '500' },
  danger: { color: C.textWhite, fontWeight: '700' },
};

const SIZE_STYLES: Record<Size, object> = {
  sm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  md: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  onPress,
  children,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        (disabled || loading) ? styles.disabled : null,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? C.textWhite : C.brand} />
      ) : (
        <Text style={[styles.text, TEXT_STYLES[variant]]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
