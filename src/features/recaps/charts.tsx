import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { RecapStats } from '@/src/lib/schemas/recap';

/**
 * Dependency-free charts built from Views. Enough for a bar-per-day column
 * chart and proportional category bars; swap for a chart library if the
 * recaps grow richer.
 */

export function DayColumns({ days, currency }: { days: RecapStats['byDay']; currency: CurrencyInfo }) {
  const max = Math.max(1, ...days.map((d) => d.totalMinor));
  const showLabels = days.length <= 7;
  return (
    <View style={styles.columns}>
      {days.map((d) => (
        <View key={d.date} style={styles.column}>
          <View style={styles.columnTrack}>
            <View style={[styles.columnFill, { height: `${Math.max(d.totalMinor > 0 ? 4 : 0, (d.totalMinor / max) * 100)}%` }]} />
          </View>
          {showLabels ? <Text style={styles.columnLabel}>{'MTWTFSS'[(new Date(`${d.date}T00:00:00`).getDay() + 6) % 7]}</Text> : null}
        </View>
      ))}
      {!showLabels ? (
        <Text style={styles.columnsCaption}>
          {days[0]?.date.slice(8)} – {days[days.length - 1]?.date.slice(8)} · peak {formatMoney(max, currency)}
        </Text>
      ) : null}
    </View>
  );
}

export function CategoryBars({ rows, currency }: { rows: RecapStats['byCategory']; currency: CurrencyInfo }) {
  const max = Math.max(1, ...rows.map((r) => r.totalMinor));
  return (
    <View style={styles.bars}>
      {rows.map((r) => (
        <View key={r.categoryId ?? 'none'} style={styles.bar}>
          <View style={styles.barHeader}>
            <View style={[styles.dot, { backgroundColor: r.colorHex ?? '#95A5A6' }]}>
              <Ionicons name={(r.icon as never) ?? 'ellipsis-horizontal-outline'} size={12} color="#fff" />
            </View>
            <Text style={styles.barName} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={styles.barValue}>{formatMoney(r.totalMinor, currency)}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(r.totalMinor / max) * 100}%`, backgroundColor: r.colorHex ?? '#95A5A6' }]} />
          </View>
          <Text style={[styles.barMeta, r.budgetPct != null && r.budgetPct > 100 && styles.over]}>
            {r.sharePct}% · {r.count} item{r.count === 1 ? '' : 's'}
            {r.budgetMinor != null ? ` · ${r.budgetPct}% of ${formatMoney(r.budgetMinor, currency)} budget` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110, flexWrap: 'wrap' },
  column: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  columnTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  columnFill: { backgroundColor: '#1F5EFF', borderRadius: 3, width: '100%' },
  columnLabel: { fontSize: 10, color: '#888' },
  columnsCaption: { width: '100%', fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 },
  bars: { gap: 12 },
  bar: { gap: 4 },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  barName: { flex: 1, fontSize: 14 },
  barValue: { fontSize: 14, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  barMeta: { fontSize: 11, color: '#888' },
  over: { color: '#C0392B', fontWeight: '600' },
});
