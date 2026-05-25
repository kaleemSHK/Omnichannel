import { View, Modal, TouchableOpacity } from 'react-native';
import type { ReactNode } from 'react';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ visible, onClose, children }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/50" activeOpacity={1} onPress={onClose} />
      <View className="bg-surface-card rounded-t-3xl border-t border-surface-border px-6 py-6">
        {children}
      </View>
    </Modal>
  );
}
