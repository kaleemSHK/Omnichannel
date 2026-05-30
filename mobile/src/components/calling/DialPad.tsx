import { View, Text, TouchableOpacity } from 'react-native';
import { C } from '@/lib/ui';

interface DialPadProps { onDigit: (digit: string) => void; }
const ROWS = [['1','2','3'],['4','5','6'],['7','8','9'],['*','0','#']];

export function DialPad({ onDigit }: DialPadProps) {
  return (
    <View style={{ gap: 12 }}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
          {row.map((digit) => (
            <TouchableOpacity key={digit} onPress={() => onDigit(digit)} activeOpacity={0.7}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>{digit}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}
