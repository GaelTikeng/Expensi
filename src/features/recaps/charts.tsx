import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { RecapStats } from '@/src/lib/schemas/recap';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

/**
 * Dependency-free charts built from Views. Enough for a bar-per-day column
 * chart and proportional category bars; swap for a chart library if the
 * recaps grow richer. Category glyphs stay on Ionicons because category rows
 * store Ionicons names; their colours come from the data.
 */

/** Fallback for categories without a stored colour (matches ExpenseRow). */
const NO_CATEGORY_COLOR = '#95A5A6';

export function DayColumns({ days, currency }: { days: RecapStats['byDay']; currency: CurrencyInfo }) {
  const max = Math.max(1, ...days.map((d) => d.totalMinor));
  const showLabels = days.length <= 7;
  return (
    <View className="h-[110px] flex-row flex-wrap items-end gap-1">
      {days.map((d) => (
        <View key={d.date} className="h-full flex-1 items-center justify-end gap-1">
          <View className="w-full flex-1 justify-end">
            <View
              className="bg-primary w-full rounded-[3px]"
              style={{ height: `${Math.max(d.totalMinor > 0 ? 4 : 0, (d.totalMinor / max) * 100)}%` }}
            />
          </View>
          {showLabels ? (
            <Text className="text-muted-foreground text-[10px]">{'MTWTFSS'[(new Date(`${d.date}T00:00:00`).getDay() + 6) % 7]}</Text>
          ) : null}
        </View>
      ))}
      {!showLabels ? (
        <Text className="text-muted-foreground mt-0.5 w-full text-center text-[11px]">
          {days[0]?.date.slice(8)} – {days[days.length - 1]?.date.slice(8)} · peak {formatMoney(max, currency)}
        </Text>
      ) : null}
    </View>
  );
}

export function CategoryBars({ rows, currency }: { rows: RecapStats['byCategory']; currency: CurrencyInfo }) {
  const theme = useThemeColors();
  const max = Math.max(1, ...rows.map((r) => r.totalMinor));
  return (
    <View className="gap-3">
      {rows.map((r) => (
        <View key={r.categoryId ?? 'none'} className="gap-1">
          <View className="flex-row items-center gap-2">
            <View className="size-5 items-center justify-center rounded-full" style={{ backgroundColor: r.colorHex ?? NO_CATEGORY_COLOR }}>
              <Ionicons name={(r.icon as never) ?? 'ellipsis-horizontal-outline'} size={12} color={theme.primaryForeground} />
            </View>
            <Text className="flex-1 text-sm" numberOfLines={1}>
              {r.name}
            </Text>
            <Text className="text-sm font-semibold">{formatMoney(r.totalMinor, currency)}</Text>
          </View>
          <View className="bg-muted h-1.5 overflow-hidden rounded-[3px]">
            <View className="h-full rounded-[3px]" style={{ width: `${(r.totalMinor / max) * 100}%`, backgroundColor: r.colorHex ?? NO_CATEGORY_COLOR }} />
          </View>
          <Text className={cn('text-muted-foreground text-[11px]', r.budgetPct != null && r.budgetPct > 100 && 'text-destructive font-semibold')}>
            {r.sharePct}% · {r.count} item{r.count === 1 ? '' : 's'}
            {r.budgetMinor != null ? ` · ${r.budgetPct}% of ${formatMoney(r.budgetMinor, currency)} budget` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}
