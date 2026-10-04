import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDDMMYYYY } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { ReviewedItem } from './review-utils';

const SEVERITY_COLOR = { ok: '#27AE60', verify: '#E67E22', blocked: '#95A5A6' } as const;

export const ImportItemRow = memo(function ImportItemRow({
  reviewed,
  selected,
  currency,
  categoryName,
  onToggle,
  onEdit,
}: {
  reviewed: ReviewedItem;
  selected: boolean;
  currency: CurrencyInfo;
  categoryName?: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { item, severity, reason } = reviewed;
  const blocked = severity === 'blocked';
  const canTick = item.lineKind === 'expense';

  return (
    <View style={[styles.row, blocked && styles.rowBlocked]}>
      <Pressable onPress={onToggle} disabled={!canTick} hitSlop={8} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
        <Ionicons
          name={canTick ? (selected ? 'checkbox' : 'square-outline') : 'remove-circle-outline'}
          size={24}
          color={canTick ? (selected ? '#1F5EFF' : '#999') : '#bbb'}
        />
      </Pressable>

      <Pressable style={styles.body} onPress={onEdit}>
        <View style={styles.topLine}>
          <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[severity] }]} />
          <Text style={[styles.desc, blocked && styles.muted]} numberOfLines={1}>
            {item.description || item.rawText || `Line ${item.lineIndex + 1}`}
          </Text>
          <Text style={[styles.amount, blocked && styles.muted]}>
            {item.amountMinor != null ? formatMoney(item.amountMinor, currency) : '—'}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {item.occurredOn ? formatDDMMYYYY(item.occurredOn) : 'No date'}
          {item.payee ? ` · ${item.payee}` : ''}
          {categoryName ? ` · ${categoryName}` : ''}
          {item.editedByUser ? ' · edited' : ''}
        </Text>
        {reason && !(severity === 'ok') ? (
          <Text style={[styles.reason, { color: SEVERITY_COLOR[severity] }]} numberOfLines={2}>
            {reason}
          </Text>
        ) : null}
        {item.rawText && item.description && item.rawText !== item.description ? (
          <Text style={styles.raw} numberOfLines={1}>
            “{item.rawText}”
          </Text>
        ) : null}
      </Pressable>

      <Ionicons name="chevron-forward" size={18} color="#bbb" />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff' },
  rowBlocked: { backgroundColor: '#FAFAFA' },
  check: { width: 28, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  desc: { flex: 1, fontSize: 15, fontWeight: '500' },
  amount: { fontSize: 15, fontWeight: '600' },
  muted: { color: '#999', textDecorationLine: 'line-through' },
  meta: { fontSize: 12, color: '#777', marginLeft: 14 },
  reason: { fontSize: 12, marginLeft: 14 },
  raw: { fontSize: 11, color: '#999', marginLeft: 14, fontStyle: 'italic' },
});
