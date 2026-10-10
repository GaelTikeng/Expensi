import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Icon } from '@/src/components/ui/icon';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import type { CurrencyLookup } from '@/src/features/expenses/money-utils';
import { daysInMonth, todayISO, type RecapPeriod } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';
import type { RecapOverview } from '@/src/lib/schemas/recap';
import { cn } from '@/src/lib/utils';
import { DayColumns } from './charts';
import { CategoryDonut } from './donut';

/**
 * F4.5 home stats, all from the overview the tiles already fetch: the week by
 * day, the month by category, the month's pace against last month, fixed vs
 * variable, and the top payees. Every card opens the matching recap.
 */
export function HomeStats({ overview, lookup }: { overview: RecapOverview; lookup: CurrencyLookup }) {
  const { week, month } = overview;
  const currency = lookup(month.currency);
  const openRecap = (period: RecapPeriod) => router.push({ pathname: '/(tabs)/recaps', params: { period, start: todayISO() } });

  if (month.count === 0 && week.count === 0) {
    return (
      <View className="bg-card border-border items-center gap-1 rounded-lg border p-5">
        <Text className="font-semibold">Nothing recorded this month yet</Text>
        <Text className="text-muted-foreground text-center text-[13px]">Add an expense or import a file, and your charts appear here.</Text>
      </View>
    );
  }

  return (
    <>
      {week.count > 0 ? (
        <StatCard title="This week, day by day" onPress={() => openRecap('week')}>
          <DayColumns days={week.byDay} currency={lookup(week.currency)} />
        </StatCard>
      ) : null}

      {month.byCategory.length > 0 ? (
        <StatCard title="This month by category" onPress={() => openRecap('month')}>
          <CategoryDonut rows={month.byCategory} totalMinor={month.totalMinor} currency={currency} />
        </StatCard>
      ) : null}

      <PaceCard month={month} currency={currency} onPress={() => openRecap('month')} />

      {month.fixedMinor > 0 ? (
        <StatCard title="Fixed charges vs everything else" onPress={() => openRecap('month')}>
          <View className="h-2.5 flex-row overflow-hidden rounded-full">
            <View className="bg-warning" style={{ flex: Math.max(month.fixedMinor, 1) }} />
            <View className="bg-primary" style={{ flex: Math.max(month.variableMinor, 1) }} />
          </View>
          <View className="flex-row justify-between">
            <Legend color="bg-warning" label={`Fixed ${formatMoney(month.fixedMinor, currency)}`} />
            <Legend color="bg-primary" label={`Other ${formatMoney(month.variableMinor, currency)}`} />
          </View>
        </StatCard>
      ) : null}

      {month.byPayee.length > 0 ? (
        <StatCard title="Where the money went" onPress={() => openRecap('month')}>
          {month.byPayee.slice(0, 3).map((p) => (
            <View key={p.payee} className="flex-row items-center justify-between gap-3">
              <Text className="shrink text-sm" numberOfLines={1}>
                {p.payee}
              </Text>
              <Text className="text-sm font-semibold">{formatMoney(p.totalMinor, currency)}</Text>
            </View>
          ))}
        </StatCard>
      ) : null}
    </>
  );
}

/** This month so far against last month, with the daily pace and where it lands. */
function PaceCard({ month, currency, onPress }: { month: RecapOverview['month']; currency: ReturnType<CurrencyLookup>; onPress: () => void }) {
  const today = todayISO();
  const elapsed = Math.max(1, Number(today.slice(8)));
  const total = daysInMonth(month.periodStart);
  const prevDays = daysInMonth(month.previous.periodStart);
  const perDay = month.totalMinor / elapsed;
  const prevPerDay = month.previous.totalMinor / prevDays;
  const projected = Math.round(perDay * total);
  const max = Math.max(month.totalMinor, month.previous.totalMinor, projected, 1);
  const faster = prevPerDay > 0 && perDay > prevPerDay;

  return (
    <StatCard title="This month vs last month" onPress={onPress}>
      <Bar label={`So far (${elapsed} day${elapsed === 1 ? '' : 's'})`} value={month.totalMinor} max={max} currency={currency} className="bg-primary" />
      <Bar label="Last month" value={month.previous.totalMinor} max={max} currency={currency} className="bg-muted-foreground/40" />
      <Text className="text-muted-foreground text-xs">
        {formatMoney(Math.round(perDay), currency)} a day
        {prevPerDay > 0 ? ` vs ${formatMoney(Math.round(prevPerDay), currency)} last month` : ''}
        {month.totalMinor > 0 && elapsed < total ? ` · on track for ${formatMoney(projected, currency)}` : ''}
      </Text>
      {prevPerDay > 0 ? (
        <Text className={cn('text-xs font-semibold', faster ? 'text-destructive' : 'text-success')}>
          {faster ? 'Spending faster than last month' : 'Spending slower than last month'}
        </Text>
      ) : null}
    </StatCard>
  );
}

function Bar({ label, value, max, currency, className }: { label: string; value: number; max: number; currency: ReturnType<CurrencyLookup>; className: string }) {
  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className="text-xs font-semibold">{formatMoney(value, currency)}</Text>
      </View>
      <View className="bg-muted h-2 overflow-hidden rounded-full">
        <View className={cn('h-full rounded-full', className)} style={{ width: `${Math.max(value > 0 ? 2 : 0, (value / max) * 100)}%` }} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-2.5 rounded-full', color)} />
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </View>
  );
}

function StatCard({ title, onPress, children }: { title: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable className="bg-card border-border active:bg-accent gap-3 rounded-lg border p-4" onPress={onPress}>
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-[13px] uppercase tracking-wide">{title}</Text>
        <Icon as={ChevronRight} className="text-muted-foreground size-4" />
      </View>
      {children}
    </Pressable>
  );
}

/** Mirrors the stat cards while the overview loads. */
export function HomeStatsSkeleton() {
  return (
    <View className="gap-3" {...loadingA11y}>
      <View className="bg-card border-border gap-3 rounded-lg border p-4">
        <SkeletonLine className="w-36" />
        <View className="h-[110px] flex-row items-end gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="flex-1 rounded-[3px]" style={{ height: `${25 + ((i * 37) % 65)}%` }} />
          ))}
        </View>
      </View>
      <View className="bg-card border-border gap-3 rounded-lg border p-4">
        <SkeletonLine className="w-40" />
        <View className="flex-row items-center gap-4">
          <Skeleton className="size-[132px] rounded-full" />
          <View className="flex-1 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} className="flex-row items-center gap-2">
                <Skeleton className="size-2.5 rounded-full" />
                <SkeletonLine className="flex-1" />
                <SkeletonLine className="w-8" />
              </View>
            ))}
          </View>
        </View>
      </View>
      <View className="bg-card border-border gap-3 rounded-lg border p-4">
        <SkeletonLine className="w-44" />
        <Skeleton className="h-2 rounded-full" />
        <Skeleton className="h-2 w-2/3 rounded-full" />
        <SkeletonLine className="w-52" />
      </View>
    </View>
  );
}
