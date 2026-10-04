import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMonthLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { PlannedMonthSummary } from '@/src/lib/schemas/planned';
import { plannedApi } from './api';

/** F5.7: a year at a glance — planned vs done per month. */
export function PlanningView({ lookup }: { lookup: (code: string) => CurrencyInfo }) {
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<PlannedMonthSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .summary(year)
      .then((r) => {
        if (!cancelled) setMonths(r.months);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, year]);

  const currency = months?.[0] ? lookup(months[0].currency) : lookup('XAF');
  const totals = (months ?? []).reduce(
    (acc, m) => ({ planned: acc.planned + m.plannedMinor, done: acc.done + m.doneMinor }),
    { planned: 0, done: 0 },
  );
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.yearRow}>
        <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#1F5EFF" />
        </Pressable>
        <Text style={styles.year}>{year}</Text>
        <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color="#1F5EFF" />
        </Pressable>
      </View>

      {months ? (
        <View style={styles.totals}>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Still planned</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.planned, currency)}</Text>
          </View>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>Done</Text>
            <Text style={[styles.totalValue, { color: '#27AE60' }]}>{formatMoney(totals.done, currency)}</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!months && !error ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}

      {months?.map((m) => {
        const empty = m.plannedCount + m.doneCount + m.skippedCount === 0;
        return (
          <Pressable
            key={m.month}
            style={[styles.month, m.month === thisMonth && styles.monthCurrent]}
            onPress={() => router.push({ pathname: '/planned/month', params: { month: m.month } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.monthName}>{formatMonthLabel(`${m.month}-01`).replace(` ${year}`, '')}</Text>
              <Text style={styles.monthMeta}>
                {empty ? 'Nothing planned' : `${m.plannedCount} planned · ${m.doneCount} done${m.skippedCount ? ` · ${m.skippedCount} skipped` : ''}`}
              </Text>
            </View>
            {!empty ? (
              <View style={{ alignItems: 'flex-end' }}>
                {m.plannedMinor > 0 ? <Text style={styles.monthPlanned}>{formatMoney(m.plannedMinor, currency)}</Text> : null}
                {m.doneMinor > 0 ? <Text style={styles.monthDone}>✓ {formatMoney(m.doneMinor, currency)}</Text> : null}
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={16} color="#bbb" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 100 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  year: { fontSize: 20, fontWeight: '700' },
  totals: { flexDirection: 'row', gap: 12 },
  total: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  totalLabel: { fontSize: 12, color: '#777', textTransform: 'uppercase' },
  totalValue: { fontSize: 18, fontWeight: '700' },
  error: { color: '#C0392B' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  monthCurrent: { borderWidth: 1, borderColor: '#1F5EFF' },
  monthName: { fontSize: 15, fontWeight: '600' },
  monthMeta: { fontSize: 12, color: '#777' },
  monthPlanned: { fontSize: 14, fontWeight: '600' },
  monthDone: { fontSize: 12, color: '#27AE60' },
});
