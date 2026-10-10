import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { formatMonthLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import { errorMessage, keys } from '@/src/lib/query';
import { cn } from '@/src/lib/utils';
import { plannedApi } from './api';

/** F5.7: a year at a glance — planned vs done per month. */
export function PlanningView({ lookup }: { lookup: (code: string) => CurrencyInfo }) {
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const [year, setYear] = useState(new Date().getFullYear());
  const query = useQuery({ queryKey: keys.planned.summary(year), queryFn: () => api.summary(year).then((r) => r.months) });
  const months = query.data ?? null;
  const error = errorMessage(query.error);

  const currency = months?.[0] ? lookup(months[0].currency) : lookup('XAF');
  const totals = (months ?? []).reduce(
    (acc, m) => ({ planned: acc.planned + m.plannedMinor, done: acc.done + m.doneMinor }),
    { planned: 0, done: 0 },
  );
  const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-2 p-4 pb-[100px]">
      <View className="flex-row items-center justify-between px-2">
        <Button variant="ghost" size="icon" onPress={() => setYear((y) => y - 1)} hitSlop={12} accessibilityLabel="Previous year">
          <Icon as={ChevronLeft} className="text-primary size-[22px]" />
        </Button>
        <Text className="text-xl font-bold">{year}</Text>
        <Button variant="ghost" size="icon" onPress={() => setYear((y) => y + 1)} hitSlop={12} accessibilityLabel="Next year">
          <Icon as={ChevronRight} className="text-primary size-[22px]" />
        </Button>
      </View>

      {months ? (
        <View className="flex-row gap-3">
          <View className="bg-card border-border flex-1 rounded-lg border p-3">
            <Text className="text-muted-foreground text-xs uppercase">Still planned</Text>
            <Text className="text-lg font-bold">{formatMoney(totals.planned, currency)}</Text>
          </View>
          <View className="bg-card border-border flex-1 rounded-lg border p-3">
            <Text className="text-muted-foreground text-xs uppercase">Done</Text>
            <Text className="text-success text-lg font-bold">{formatMoney(totals.done, currency)}</Text>
          </View>
        </View>
      ) : null}

      {error ? <Text className="text-destructive">{error}</Text> : null}
      {!months && !error ? <PlanningSkeleton /> : null}

      {months?.map((m) => {
        const empty = m.plannedCount + m.doneCount + m.skippedCount === 0;
        return (
          <Pressable
            key={m.month}
            className={cn(
              'bg-card flex-row items-center gap-2.5 rounded-lg border p-3.5 active:bg-accent',
              m.month === thisMonth ? 'border-primary' : 'border-border',
            )}
            onPress={() => router.push({ pathname: '/planned/month', params: { month: m.month } })}
          >
            <View className="flex-1">
              <Text className="text-[15px] font-semibold">{formatMonthLabel(`${m.month}-01`).replace(` ${year}`, '')}</Text>
              <Text className="text-muted-foreground text-xs">
                {empty ? 'Nothing planned' : `${m.plannedCount} planned · ${m.doneCount} done${m.skippedCount ? ` · ${m.skippedCount} skipped` : ''}`}
              </Text>
            </View>
            {!empty ? (
              <View className="items-end">
                {m.plannedMinor > 0 ? <Text className="text-sm font-semibold">{formatMoney(m.plannedMinor, currency)}</Text> : null}
                {m.doneMinor > 0 ? <Text className="text-success text-xs">✓ {formatMoney(m.doneMinor, currency)}</Text> : null}
              </View>
            ) : null}
            <Icon as={ChevronRight} className="text-muted-foreground size-4" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Mirrors the two year totals and the twelve month cards while the summary loads. */
function PlanningSkeleton() {
  return (
    <View className="gap-2" {...loadingA11y}>
      <View className="flex-row gap-3">
        {[0, 1].map((i) => (
          <View key={i} className="bg-card border-border flex-1 gap-2 rounded-lg border p-3">
            <SkeletonLine className="w-20" />
            <SkeletonLine className="h-4 w-24" />
          </View>
        ))}
      </View>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} className="bg-card border-border flex-row items-center gap-2.5 rounded-lg border p-3.5">
          <View className="flex-1 gap-2">
            <SkeletonLine className="h-3.5 w-24" />
            <SkeletonLine className={i % 3 === 0 ? 'w-40' : 'w-28'} />
          </View>
          {i % 3 === 0 ? <SkeletonLine className="h-3.5 w-20" /> : null}
        </View>
      ))}
    </View>
  );
}
