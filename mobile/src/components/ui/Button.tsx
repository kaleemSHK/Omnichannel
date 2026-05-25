import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ReactNode } from 'react';

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

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand',
  secondary: 'bg-surface-card border border-surface-border',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const TEXT: Record<Variant, string> = {
  primary: 'text-black font-bold',
  secondary: 'text-text-primary font-medium',
  ghost: 'text-brand font-medium',
  danger: 'text-white font-bold',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-xl',
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
      className={`items-center justify-center active:opacity-80 ${VARIANTS[variant]} ${SIZES[size]} ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#000' : '#fff'} />
      ) : (
        <Text className={TEXT[variant]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
