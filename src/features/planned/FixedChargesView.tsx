import { router } from 'expo-router';
import { Check, CirclePlus, Minus, Repeat } from 'lucide-react-native';

import { Pressable, ScrollView, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Icon } from '@/src/components/ui/icon';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { sumByCurrency, formatTotals } from '@/src/features/expenses/money-utils';
import { formatMonthLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import { errorMessage, keys, useRefetchOnFocus } from '@/src/lib/query';
import { cn } from '@/src/lib/utils';
import { useRecurringList } from './usePlanned';

/** F6.4: fixed charges with this month's paid / unpaid state and the monthly total. */
export function FixedChargesView({ lookup }: { lookup: (code: string) => CurrencyInfo }) {
  const query = useRecurringList();
  const items = query.data?.items ?? null;
  const periodStart = query.data?.periodStart ?? null;
  const error = errorMessage(query.error);
  useRefetchOnFocus(keys.recurring.all);

  const active = (items ?? []).filter((c) => c.isActive);
  const total = formatTotals(sumByCurrency(active.map((c) => ({ amountMinor: c.amountMinor, currency: c.currency }))), lookup);
  const paid = active.filter((c) => c.currentMonth?.status === 'done').length;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-2 p-4 pb-[100px]">
      <View className="bg-card border-border gap-0.5 rounded-lg border p-4">
        <Text className="text-muted-foreground text-xs uppercase">{periodStart ? formatMonthLabel(periodStart) : 'This month'} · fixed charges</Text>
        {items ? <Text className="text-2xl font-bold">{active.length ? total : '—'}</Text> : <SkeletonLine className="my-2 h-6 w-36" />}
        {!items ? <SkeletonLine className="w-20" /> : null}
        {active.length ? (
          <Text className="text-muted-foreground text-xs">
            {paid} of {active.length} paid
          </Text>
        ) : null}
      </View>

      <Pressable
        className="border-primary flex-row items-center justify-center gap-2 rounded-lg border border-dashed p-3 active:bg-accent"
        onPress={() => router.push('/recurring/new')}
      >
        <Icon as={CirclePlus} className="text-primary size-5" />
        <Text className="text-primary font-semibold">Add a fixed charge</Text>
      </Pressable>

      {error ? <Text className="text-destructive">{error}</Text> : null}
      {!items && !error ? (
        <View className="gap-2" {...loadingA11y}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="bg-card border-border flex-row items-center gap-3 rounded-lg border p-3.5">
              <Skeleton className="size-[30px] rounded-full" />
              <View className="flex-1 gap-2">
                <SkeletonLine className={cn('h-3.5', ['w-24', 'w-32', 'w-20', 'w-28'][i])} />
                <SkeletonLine className="w-36" />
              </View>
              <SkeletonLine className="h-3.5 w-16" />
            </View>
          ))}
        </View>
      ) : null}
      {items && items.length === 0 ? (
        <Text className="text-muted-foreground p-4 text-center">Rent, subscriptions, school fees… anything you pay every month.</Text>
      ) : null}

      {items?.map((c) => {
        const status = !c.isActive ? 'inactive' : (c.currentMonth?.status ?? 'planned');
        return (
          <Pressable
            key={c.id}
            className="bg-card border-border flex-row items-center gap-3 rounded-lg border p-3.5 active:bg-accent"
            onPress={() => router.push(`/recurring/${c.id}`)}
            onLongPress={() => c.currentMonth && router.push(`/planned/${c.currentMonth.plannedId}`)}
          >
            <View
              className={cn(
                'size-[30px] items-center justify-center rounded-full',
                status === 'done' ? 'bg-success' : status === 'planned' ? 'bg-primary' : 'bg-muted',
              )}
            >
              <Icon
                as={status === 'done' ? Check : status === 'skipped' ? Minus : Repeat}
                className={cn(
                  'size-4',
                  status === 'done' ? 'text-success-foreground' : status === 'planned' ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              />
            </View>
            <View className="flex-1">
              <Text className={cn('text-[15px] font-medium', !c.isActive && 'text-muted-foreground')}>{c.name}</Text>
              <Text className="text-muted-foreground text-xs">
                Day {c.dayOfMonth} · {c.reminderTime}
                {c.payee ? ` · ${c.payee}` : ''}
                {!c.isActive ? ' · inactive' : status === 'done' ? ' · paid' : status === 'skipped' ? ' · skipped' : ' · due'}
              </Text>
            </View>
            <Text className="text-[15px] font-semibold">{formatMoney(c.amountMinor, lookup(c.currency))}</Text>
          </Pressable>
        );
      })}
      {items && items.length > 0 ? <Text className="text-muted-foreground text-center text-[11px]">{'Tap to edit · hold to open this month\u2019s payment'}</Text> : null}
    </ScrollView>
  );
}
