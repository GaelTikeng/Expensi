import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { CategoryBars, DayColumns } from '@/src/features/recaps/charts';
import { useRecap } from '@/src/features/recaps/useRecap';
import { useMe } from '@/src/features/settings/useMe';
import { formatDDMMYYYY, nextPeriodStart, periodLabel, periodStart, previousPeriodStart, todayISO, type RecapPeriod } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';

const PERIODS: { key: RecapPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/** F4.4: period switcher, headline, charts, breakdowns, AI narrative. */
export default function RecapsScreen() {
  const params = useLocalSearchParams<{ period?: string; start?: string }>();
  const [period, setPeriod] = useState<RecapPeriod>((params.period as RecapPeriod) ?? 'month');
  const [start, setStart] = useState(() => periodStart(period, params.start ?? todayISO()));
  const { recap, loading, narrativeLoading, error, reload } = useRecap(period, start);
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reload();
    }, [reload]),
  );

  const switchPeriod = (p: RecapPeriod) => {
    setPeriod(p);
    setStart(periodStart(p, todayISO()));
  };
  const today = todayISO();
  const canGoForward = nextPeriodStart(period, start) <= today;

  const s = recap?.stats;
  const currency = lookup(s?.currency ?? 'XAF');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.segment}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} style={[styles.segmentItem, period === p.key && styles.segmentActive]} onPress={() => switchPeriod(p.key)}>
            <Text style={[styles.segmentText, period === p.key && styles.segmentTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.nav}>
        <Pressable onPress={() => setStart(previousPeriodStart(period, start))} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#1F5EFF" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.navTitle}>{periodLabel(period, start)}</Text>
          {s ? (
            <Text style={styles.navSub}>
              {s.periodStart === s.periodEnd ? formatDDMMYYYY(s.periodStart) : `${formatDDMMYYYY(s.periodStart)} – ${formatDDMMYYYY(s.periodEnd)}`}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => canGoForward && setStart(nextPeriodStart(period, start))} hitSlop={12} disabled={!canGoForward}>
          <Ionicons name="chevron-forward" size={22} color={canGoForward ? '#1F5EFF' : '#ccc'} />
        </Pressable>
      </View>

      {loading && !s ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : error && !s ? (
        <Text style={styles.error}>{error}</Text>
      ) : s ? (
        <>
          <View style={styles.card}>
            <Text style={styles.headline}>{formatMoney(s.totalMinor, currency)}</Text>
            <Text style={styles.sub}>
              {s.count} expense{s.count === 1 ? '' : 's'}
              {s.estimatedCount > 0 ? ` · ${s.estimatedCount} estimated` : ''}
              {s.withProofCount > 0 ? ` · ${s.withProofCount} with proof` : ''}
            </Text>
            <Delta deltaMinor={s.previous.deltaMinor} deltaPct={s.previous.deltaPct} currency={currency} period={period} />
            {s.otherCurrencies.length > 0 ? (
              <Text style={styles.sub}>
                Also: {s.otherCurrencies.map((o) => `${formatMoney(o.totalMinor, lookup(o.currency))} (${o.count})`).join(', ')}
              </Text>
            ) : null}
          </View>

          {period !== 'day' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>By day</Text>
              <DayColumns days={s.byDay} currency={currency} />
            </View>
          ) : null}

          {(recap?.narrativeMd || narrativeLoading) && period !== 'day' ? (
            <View style={[styles.card, styles.narrative]}>
              <View style={styles.narrativeHeader}>
                <Ionicons name="sparkles-outline" size={16} color="#6C3FB5" />
                <Text style={styles.narrativeTitle}>In short</Text>
              </View>
              {narrativeLoading && !recap?.narrativeMd ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" />
                  <Text style={styles.sub}>Writing your summary…</Text>
                </View>
              ) : (
                <Text style={styles.narrativeText}>{recap?.narrativeMd}</Text>
              )}
            </View>
          ) : null}

          {s.byCategory.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>By category</Text>
              <CategoryBars rows={s.byCategory} currency={currency} />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sub}>Nothing recorded in this period.</Text>
            </View>
          )}

          {s.fixedMinor > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fixed vs variable</Text>
              <View style={styles.split}>
                <View style={[styles.splitFixed, { flex: Math.max(s.fixedMinor, 1) }]} />
                <View style={[styles.splitVariable, { flex: Math.max(s.variableMinor, 1) }]} />
              </View>
              <Text style={styles.sub}>
                Fixed charges {formatMoney(s.fixedMinor, currency)} · everything else {formatMoney(s.variableMinor, currency)}
              </Text>
            </View>
          ) : null}

          {s.byPayee.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top payees</Text>
              {s.byPayee.map((p) => (
                <View key={p.payee} style={styles.line}>
                  <Text style={styles.lineText} numberOfLines={1}>
                    {p.payee}
                  </Text>
                  <Text style={styles.lineValue}>{formatMoney(p.totalMinor, currency)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {s.largest.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Largest</Text>
              {s.largest.map((e) => (
                <View key={e.id} style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineText} numberOfLines={1}>
                      {e.description}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {formatDDMMYYYY(e.occurredOn)}
                      {e.categoryName ? ` · ${e.categoryName}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.lineValue}>{formatMoney(e.amountMinor, currency)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function Delta({ deltaMinor, deltaPct, currency, period }: { deltaMinor: number; deltaPct: number | null; currency: ReturnType<ReturnType<typeof makeCurrencyLookup>>; period: RecapPeriod }) {
  const prevLabel = period === 'day' ? 'yesterday' : period === 'week' ? 'last week' : 'last month';
  if (deltaMinor === 0) return <Text style={styles.sub}>Same as {prevLabel}</Text>;
  const up = deltaMinor > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={14} color={up ? '#C0392B' : '#27AE60'} />
      <Text style={[styles.sub, { color: up ? '#C0392B' : '#27AE60' }]}>
        {formatMoney(Math.abs(deltaMinor), currency)}
        {deltaPct != null ? ` (${Math.abs(deltaPct)}%)` : ''} {up ? 'more' : 'less'} than {prevLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  segment: { flexDirection: 'row', backgroundColor: '#E3E6EB', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: '#555' },
  segmentTextActive: { color: '#111', fontWeight: '600' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  navTitle: { fontSize: 17, fontWeight: '600' },
  navSub: { fontSize: 12, color: '#777' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 13, color: '#777', textTransform: 'uppercase', marginBottom: 4 },
  headline: { fontSize: 32, fontWeight: '700' },
  sub: { fontSize: 13, color: '#666' },
  error: { color: '#C0392B', padding: 16 },
  narrative: { backgroundColor: '#F4EEFF' },
  narrativeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  narrativeTitle: { fontSize: 13, color: '#6C3FB5', fontWeight: '600', textTransform: 'uppercase' },
  narrativeText: { fontSize: 15, lineHeight: 22, color: '#333' },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  splitFixed: { backgroundColor: '#8E44AD' },
  splitVariable: { backgroundColor: '#1F5EFF' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  lineText: { fontSize: 14, flexShrink: 1 },
  lineMeta: { fontSize: 11, color: '#888' },
  lineValue: { fontSize: 14, fontWeight: '600' },
});
