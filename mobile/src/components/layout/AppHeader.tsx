import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

interface AppHeaderProps {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}

export function AppHeader({ title, right, onBack }: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-surface-border bg-bg">
      <TouchableOpacity onPress={onBack ?? (() => router.back())} className="mr-3 py-1">
        <Text className="text-brand text-base">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="text-text-primary font-bold text-lg flex-1" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
