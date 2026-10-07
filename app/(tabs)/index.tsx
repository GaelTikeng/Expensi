import { useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { useRecapOverview } from '@/src/features/recaps/useRecap';
import { useMe } from '@/src/features/settings/useMe';
import { todayISO, type RecapPeriod } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';
import type { RecapStats } from '@/src/lib/schemas/recap';

/** F4.5: today / this week / this month at a glance, plus quick actions. */
export default function HomeScreen() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'there';
  const { overview, loading, error, reload } = useRecapOverview();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const openRecap = (period: RecapPeriod) => router.push({ pathname: '/(tabs)/recaps', params: { period, start: todayISO() } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hello, {name}</Text>

      {loading && !overview ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : error && !overview ? (
        <Text style={styles.error}>{error}</Text>
      ) : overview ? (
        <>
          <Tile label="Today" stats={overview.today} lookup={lookup} onPress={() => openRecap('day')} prevLabel="yesterday" />
          <View style={styles.row}>
            <Tile label="This week" stats={overview.week} lookup={lookup} onPress={() => openRecap('week')} prevLabel="last week" compact />
            <Tile label="This month" stats={overview.month} lookup={lookup} onPress={() => openRecap('month')} prevLabel="last month" compact />
          </View>
          {overview.month.byCategory[0] ? (
            <Text style={styles.hint}>
              Biggest this month: {overview.month.byCategory[0].name} · {formatMoney(overview.month.byCategory[0].totalMinor, lookup(overview.month.currency))}
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.actions}>
        <Action icon="add-circle-outline" label="Add expense" onPress={() => router.push('/expense/new')} />
        <Action icon="cloud-upload-outline" label="Import file" onPress={() => router.push('/import')} />
        <Action icon="stats-chart-outline" label="Recaps" onPress={() => openRecap('month')} />
      </View>
    </ScrollView>
  );
}

function Tile({
  label,
  stats,
  lookup,
  onPress,
  prevLabel,
  compact,
}: {
  label: string;
  stats: RecapStats;
  lookup: ReturnType<typeof makeCurrencyLookup>;
  onPress: () => void;
  prevLabel: string;
  compact?: boolean;
}) {
  const currency = lookup(stats.currency);
  const d = stats.previous.deltaMinor;
  return (
    <Pressable style={[styles.tile, compact && styles.tileCompact]} onPress={onPress}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, compact && styles.tileValueCompact]} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(stats.totalMinor, currency)}
      </Text>
      <Text style={styles.tileMeta}>
        {stats.count} item{stats.count === 1 ? '' : 's'}
        {d !== 0 ? ` · ${d > 0 ? '↑' : '↓'} ${formatMoney(Math.abs(d), currency)} vs ${prevLabel}` : ''}
      </Text>
    </Pressable>
  );
}

function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#1F5EFF" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  greeting: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 12 },
  tile: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 4 },
  tileCompact: { flex: 1 },
  tileLabel: { fontSize: 12, color: '#777', textTransform: 'uppercase' },
  tileValue: { fontSize: 30, fontWeight: '700' },
  tileValueCompact: { fontSize: 20 },
  tileMeta: { fontSize: 12, color: '#777' },
  hint: { fontSize: 13, color: '#555', marginLeft: 4 },
  error: { color: '#C0392B' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 12, color: '#333', textAlign: 'center' },
});
