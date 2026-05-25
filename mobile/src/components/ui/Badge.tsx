import { View, Text } from 'react-native';

export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View className="bg-danger min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center">
      <Text className="text-white text-[10px] font-bold">{label}</Text>
    </View>
  );
}
