import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { sumByCurrency, formatTotals } from '@/src/features/expenses/money-utils';
import { formatMonthLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { RecurringDto } from '@/src/lib/schemas/recurring';
import { recurringApi } from './api';

/** F6.4: fixed charges with this month's paid / unpaid state and the monthly total. */
export function FixedChargesView({ lookup }: { lookup: (code: string) => CurrencyInfo }) {
  const { getToken } = useAuth();
  const api = useMemo(() => recurringApi(getToken), [getToken]);
  const [items, setItems] = useState<RecurringDto[] | null>(null);
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .materialize()
        .catch(() => undefined)
        .then(() => api.list())
        .then((r) => {
          if (cancelled) return;
          setItems(r.items);
          setPeriodStart(r.periodStart);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
      return () => {
        cancelled = true;
      };
    }, [api]),
  );

  const active = (items ?? []).filter((c) => c.isActive);
  const total = formatTotals(sumByCurrency(active.map((c) => ({ amountMinor: c.amountMinor, currency: c.currency }))), lookup);
  const paid = active.filter((c) => c.currentMonth?.status === 'done').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{periodStart ? formatMonthLabel(periodStart) : 'This month'} · fixed charges</Text>
        <Text style={styles.summaryValue}>{active.length ? total : '—'}</Text>
        {active.length ? (
          <Text style={styles.summaryMeta}>
            {paid} of {active.length} paid
          </Text>
        ) : null}
      </View>

      <Pressable style={styles.add} onPress={() => router.push('/recurring/new')}>
        <Ionicons name="add-circle-outline" size={20} color="#1F5EFF" />
        <Text style={styles.addText}>Add a fixed charge</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!items && !error ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
      {items && items.length === 0 ? <Text style={styles.empty}>Rent, subscriptions, school fees… anything you pay every month.</Text> : null}

      {items?.map((c) => {
        const status = !c.isActive ? 'inactive' : (c.currentMonth?.status ?? 'planned');
        return (
          <Pressable
            key={c.id}
            style={styles.row}
            onPress={() => router.push(`/recurring/${c.id}`)}
            onLongPress={() => c.currentMonth && router.push(`/planned/${c.currentMonth.plannedId}`)}
          >
            <View style={[styles.badge, styles[`badge_${status}` as const]]}>
              <Ionicons name={status === 'done' ? 'checkmark' : status === 'skipped' ? 'remove' : 'repeat-outline'} size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, !c.isActive && styles.muted]}>{c.name}</Text>
              <Text style={styles.meta}>
                Day {c.dayOfMonth} · {c.reminderTime}
                {c.payee ? ` · ${c.payee}` : ''}
                {!c.isActive ? ' · inactive' : status === 'done' ? ' · paid' : status === 'skipped' ? ' · skipped' : ' · due'}
              </Text>
            </View>
            <Text style={styles.amount}>{formatMoney(c.amountMinor, lookup(c.currency))}</Text>
          </Pressable>
        );
      })}
      {items && items.length > 0 ? <Text style={styles.hint}>{'Tap to edit · hold to open this month\u2019s payment'}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 100 },
  summary: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 2 },
  summaryLabel: { fontSize: 12, color: '#777', textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  summaryMeta: { fontSize: 12, color: '#777' },
  add: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1F5EFF', borderStyle: 'dashed' },
  addText: { color: '#1F5EFF', fontWeight: '600' },
  error: { color: '#C0392B' },
  empty: { color: '#777', textAlign: 'center', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge_planned: { backgroundColor: '#1F5EFF' },
  badge_done: { backgroundColor: '#27AE60' },
  badge_skipped: { backgroundColor: '#95A5A6' },
  badge_inactive: { backgroundColor: '#ccc' },
  name: { fontSize: 15, fontWeight: '500' },
  muted: { color: '#999' },
  meta: { fontSize: 12, color: '#777' },
  amount: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 11, color: '#999', textAlign: 'center' },
});
