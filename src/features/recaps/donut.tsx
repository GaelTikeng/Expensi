import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Text } from '@/src/components/ui/text';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { RecapStats } from '@/src/lib/schemas/recap';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

const NO_CATEGORY_COLOR = '#95A5A6';
const MAX_SLICES = 5;

/**
 * Share of the period's spend per category, as a ring plus a legend. The top
 * categories get a slice each; the rest fold into "Other". Pure SVG, no chart
 * library (react-native-svg is already a dependency of the icon set).
 */
export function CategoryDonut({ rows, totalMinor, currency }: { rows: RecapStats['byCategory']; totalMinor: number; currency: CurrencyInfo }) {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const sorted = [...rows].sort((a, b) => b.totalMinor - a.totalMinor);
  const head = sorted.slice(0, MAX_SLICES);
  const tail = sorted.slice(MAX_SLICES);
  const slices = [
    ...head.map((r) => ({ key: r.categoryId ?? 'none', name: r.name, color: r.colorHex ?? NO_CATEGORY_COLOR, totalMinor: r.totalMinor, budgetPct: r.budgetPct, budgetMinor: r.budgetMinor })),
    ...(tail.length
      ? [{ key: 'other', name: t('stats.otherCategories', { n: tail.length }), color: theme.mutedForeground, totalMinor: tail.reduce((s, r) => s + r.totalMinor, 0), budgetPct: null, budgetMinor: null }]
      : []),
  ];
  const sum = Math.max(1, slices.reduce((s, r) => s + r.totalMinor, 0));

  const size = 132;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View className="flex-row items-center gap-4">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.muted} strokeWidth={stroke} fill="none" />
            {slices.map((s) => {
              const len = (s.totalMinor / sum) * c;
              const el = (
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </G>
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-[13px] font-bold" numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(totalMinor, currency)}
          </Text>
          <Text className="text-muted-foreground text-[10px]">{t('stats.donutCenter')}</Text>
        </View>
      </View>

      <View className="flex-1 gap-1.5">
        {slices.map((s) => {
          const pct = Math.round((s.totalMinor / sum) * 100);
          const over = s.budgetPct != null && s.budgetPct > 100;
          return (
            <View key={s.key} className="flex-row items-center gap-2">
              <View className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <Text className="flex-1 text-[13px]" numberOfLines={1}>
                {s.name}
              </Text>
              <View className="items-end">
                <Text className="text-[13px] font-semibold">{pct}%</Text>
                {s.budgetPct != null ? (
                  <Text className={cn('text-[10px]', over ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{t('stats.ofBudget', { pct: s.budgetPct })}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
