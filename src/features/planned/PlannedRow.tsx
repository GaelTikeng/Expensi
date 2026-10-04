import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const PlannedRow = memo(function PlannedRow({
  item,
  currency,
  overdue,
  onPress,
  onDone,
}: {
  item: PlannedDto;
  currency: CurrencyInfo;
  overdue?: boolean;
  onPress: () => void;
  onDone?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.icon, overdue && styles.iconOverdue, item.status === 'done' && styles.iconDone]}>
        <Ionicons
          name={item.status === 'done' ? 'checkmark' : item.recurringChargeId ? 'repeat-outline' : 'calendar-outline'}
          size={18}
          color="#fff"
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, item.status !== 'planned' && styles.muted]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.meta, overdue && styles.overdueText]} numberOfLines={1}>
          {when(item.scheduledAt)}
          {item.place ? ` · ${item.place}` : ''}
          {item.payee ? ` · ${item.payee}` : ''}
        </Text>
      </View>
      <Text style={styles.amount}>{formatMoney(item.amountMinor, currency)}</Text>
      {onDone && item.status === 'planned' ? (
        <Pressable onPress={onDone} hitSlop={10} style={styles.doneBtn} accessibilityLabel="Mark as paid">
          <Ionicons name="checkmark-circle-outline" size={26} color="#27AE60" />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff' },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1F5EFF', alignItems: 'center', justifyContent: 'center' },
  iconOverdue: { backgroundColor: '#E67E22' },
  iconDone: { backgroundColor: '#27AE60' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500' },
  muted: { color: '#999' },
  meta: { fontSize: 12, color: '#777' },
  overdueText: { color: '#E67E22', fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '600' },
  doneBtn: { marginLeft: 4 },
});
