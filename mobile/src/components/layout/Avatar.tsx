import { View, Text, Image } from 'react-native';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
  online?: boolean;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const COLORS = ['#3182ce', '#805ad5', '#38a169', '#d69e2e', '#e53e3e'];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, imageUrl, size = 40, online }: AvatarProps) {
  const s = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={{ position: 'relative' }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={s} />
      ) : (
        <View style={[s, { backgroundColor: colorForName(name), alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.35 }}>{initials(name || '?')}</Text>
        </View>
      )}
      {online ? (
        <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-bg" />
      ) : null}
    </View>
  );
}
