import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/layout/AppHeader';
import { createTicket } from '@/api/tickets';
import { createCustomerTicket } from '@/api/customer';
import { loadCustomerSession, loadPrefs } from '@/lib/storage';
import { C } from '@/lib/ui';

const PRIORITIES = [
  { label: 'low', value: 'p4' },
  { label: 'medium', value: 'p3' },
  { label: 'high', value: 'p2' },
  { label: 'urgent', value: 'p1' },
] as const;
type PriorityValue = (typeof PRIORITIES)[number]['value'];

const PRIORITY_COLORS: Record<string, string> = {
  p4: C.green,
  p3: C.brand,
  p2: C.amber,
  p1: C.red,
};

export default function NewTicket() {
  const navigation = useNavigation();
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
      const prefs = await loadPrefs();
      const session = await loadCustomerSession();
      if (prefs.role === 'customer') {
        await createCustomerTicket({
          subject: subject.trim(),
          description: description.trim(),
          priority,
        });
      } else {
        await createTicket({
          subject: subject.trim(),
          description: description.trim(),
          priority,
          contactId: session.contactId ? String(session.contactId) : undefined,
        });
      }
      Alert.alert('Submitted', 'Your ticket has been created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="New Support Ticket" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Subject *</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Describe your issue briefly"
          placeholderTextColor={C.textMute}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Provide more details (optional)"
          placeholderTextColor={C.textMute}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={[styles.input, styles.textArea]}
        />

        <Text style={styles.fieldLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => {
            const active = priority === p.value;
            const color = PRIORITY_COLORS[p.value];
            return (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[
                  styles.priorityChip,
                  {
                    borderColor: active ? color : C.border,
                    backgroundColor: active ? color + '22' : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.priorityChipText, { color: active ? color : C.textMute }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={styles.submitBtn}
        >
          {loading ? (
            <ActivityIndicator color={C.textWhite} />
          ) : (
            <Text style={styles.submitBtnText}>Submit Ticket</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  fieldLabel: {
    color: C.textMute,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    marginBottom: 16,
  },
  textArea: {
    height: 112,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  priorityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityChipText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  submitBtn: {
    backgroundColor: C.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: C.textWhite,
    fontWeight: '700',
    fontSize: 16,
  },
});
