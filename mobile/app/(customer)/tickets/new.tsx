import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/AppHeader';
import { createTicket } from '@/api/tickets';
import { loadCustomerSession } from '@/lib/storage';

// Map UI labels to backend priority enum
const PRIORITIES = [
  { label: 'low', value: 'p4' },
  { label: 'medium', value: 'p3' },
  { label: 'high', value: 'p2' },
  { label: 'urgent', value: 'p1' },
] as const;
type PriorityValue = typeof PRIORITIES[number]['value'];

export default function NewTicket() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityValue>('p3');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!subject.trim()) {
      Alert.alert('Required', 'Please enter a subject for your ticket.');
      return;
    }
    setLoading(true);
    try {
      const session = await loadCustomerSession();
      await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        priority,
        contactId: session.contactId ? String(session.contactId) : undefined,
      });
      Alert.alert('Submitted', 'Your ticket has been created.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const PRIORITY_COLORS: Record<string, string> = {
    p4: '#48bb78', p3: '#63b3ed', p2: '#f6ad55', p1: '#fc8181',
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <AppHeader title="New Support Ticket" onBack={() => router.back()} />
      <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-text-muted text-xs uppercase tracking-widest mb-1">Subject *</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Describe your issue briefly"
          placeholderTextColor="#5a6170"
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary mb-4"
        />

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-1">Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Provide more details (optional)"
          placeholderTextColor="#5a6170"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary mb-4 h-28"
        />

        <Text className="text-text-muted text-xs uppercase tracking-widest mb-2">Priority</Text>
        <View className="flex-row gap-2 mb-8 flex-wrap">
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPriority(p.value)}
              className={`px-4 py-2 rounded-full border ${priority === p.value ? 'border-brand' : 'border-surface-border'}`}
              style={priority === p.value ? { backgroundColor: PRIORITY_COLORS[p.value] + '22' } : {}}
            >
              <Text
                className="text-sm font-medium capitalize"
                style={{ color: priority === p.value ? PRIORITY_COLORS[p.value] : '#5a6170' }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          className="bg-brand rounded-xl py-4 items-center"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Submit Ticket</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
