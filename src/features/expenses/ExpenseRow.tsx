import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { relativeDayLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

export const ExpenseRow = memo(function ExpenseRow({
  expense,
  category,
  currency,
  onPress,
  onDelete,
}: {
  expense: ExpenseDto;
  category?: CategoryDto;
  currency: CurrencyInfo;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable style={styles.deleteAction} onPress={onDelete} accessibilityLabel="Delete expense">
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Pressable>
      )}
    >
      <Pressable style={styles.row} onPress={onPress}>
        <View style={[styles.icon, { backgroundColor: category?.colorHex ?? '#95A5A6' }]}>
          <Ionicons name={(category?.icon as never) ?? 'ellipsis-horizontal-outline'} size={18} color="#fff" />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {expense.description}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {relativeDayLabel(expense.occurredOn)}
            {expense.payee ? ` · ${expense.payee}` : ''}
            {category ? ` · ${category.name}` : ''}
          </Text>
        </View>
        <View style={styles.amountWrap}>
          <Text style={styles.amount}>{formatMoney(expense.amountMinor, currency)}</Text>
          {expense.isEstimated ? <Text style={styles.badge}>est.</Text> : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12, color: '#777' },
  amountWrap: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '600' },
  badge: { fontSize: 10, color: '#B9770E', textTransform: 'uppercase' },
  deleteAction: { backgroundColor: '#C0392B', justifyContent: 'center', alignItems: 'center', width: 72 },
});
