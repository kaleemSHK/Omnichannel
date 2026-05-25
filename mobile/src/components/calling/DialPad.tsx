import { View, Text, TouchableOpacity } from 'react-native';

interface DialPadProps {
  onDigit: (digit: string) => void;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function DialPad({ onDigit }: DialPadProps) {
  return (
    <View className="gap-3">
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row justify-center gap-4">
          {row.map((digit) => (
            <TouchableOpacity
              key={digit}
              onPress={() => onDigit(digit)}
              className="w-16 h-16 rounded-full bg-surface-card border border-surface-border items-center justify-center active:opacity-70"
            >
              <Text className="text-text-primary text-2xl font-bold">{digit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}
