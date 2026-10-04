import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LocalFilesPicker } from '@/src/features/attachments/LocalFilesPicker';
import type { LocalFile } from '@/src/features/attachments/pick';
import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';

export interface CompleteValues {
  amountMinor: number;
  occurredOn: string;
  files: LocalFile[];
}

/** F5.6 + F2b.8: confirm what was actually paid, when, with an optional receipt. */
export function CompleteSheet({
  plan,
  currency,
  busy,
  onConfirm,
  onClose,
}: {
  plan: PlannedDto | null;
  currency: CurrencyInfo;
  busy: boolean;
  onConfirm: (values: CompleteValues) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={plan !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {plan ? <Body key={plan.id} plan={plan} currency={currency} busy={busy} onConfirm={onConfirm} onClose={onClose} /> : null}
      </View>
    </Modal>
  );
}

function Body({ plan, currency, busy, onConfirm, onClose }: { plan: PlannedDto; currency: CurrencyInfo; busy: boolean; onConfirm: (v: CompleteValues) => void; onClose: () => void }) {
  const [amountMinor, setAmountMinor] = useState<number | null>(plan.amountMinor);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [files, setFiles] = useState<LocalFile[]>([]);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>Mark as paid</Text>
      <Text style={styles.sub}>{plan.title}</Text>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Amount actually paid</Text>
        <AmountInput value={amountMinor} currency={currency} onChange={setAmountMinor} />
        <View style={styles.card}>
          <DateField label="Paid on" value={occurredOn} onChange={(d) => d && setOccurredOn(d)} />
        </View>
        <LocalFilesPicker files={files} onChange={setFiles} />
      </ScrollView>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={onClose} disabled={busy}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primary, (busy || !amountMinor) && styles.disabled]}
          disabled={busy || !amountMinor}
          onPress={() => amountMinor && onConfirm({ amountMinor, occurredOn, files })}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F6F7F9', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 32, maxHeight: '90%', gap: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 14, color: '#666' },
  body: { gap: 12, paddingVertical: 8 },
  label: { fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  primary: { flex: 1, backgroundColor: '#27AE60', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondary: { flex: 1, borderWidth: 1, borderColor: '#D7DAE0', borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { fontSize: 16 },
  disabled: { opacity: 0.5 },
});
