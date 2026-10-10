import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { CloudUpload, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { TabScreen } from '@/src/components/tab-screen';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { useRecapOverview } from '@/src/features/recaps/useRecap';
import { useMe } from '@/src/features/settings/useMe';
import { todayISO, type RecapPeriod } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';
import { keys, useRefetchOnFocus } from '@/src/lib/query';
import type { RecapStats } from '@/src/lib/schemas/recap';
import { cn } from '@/src/lib/utils';

/** F4.5: today / this week / this month at a glance, plus quick actions. */
export default function HomeScreen() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split('@')[0] ?? 'there';
  const { overview, loading, error } = useRecapOverview();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  // Changes made elsewhere (new expense, completed plan) refresh the tiles in the background.
  useRefetchOnFocus(keys.recaps.overview);

  const openRecap = (period: RecapPeriod) => router.push({ pathname: '/(tabs)/recaps', params: { period, start: todayISO() } });

  return (
    <TabScreen>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-24">
        <Text variant="h3" className="mb-1 font-bold">
          Hello, {name}
        </Text>

        {loading && !overview ? (
          <TilesSkeleton />
        ) : error && !overview ? (
          <Text className="text-destructive">{error}</Text>
        ) : overview ? (
          <>
            <Tile label="Today" stats={overview.today} lookup={lookup} onPress={() => openRecap('day')} prevLabel="yesterday" />
            <View className="flex-row gap-3">
              <Tile label="This week" stats={overview.week} lookup={lookup} onPress={() => openRecap('week')} prevLabel="last week" compact />
              <Tile label="This month" stats={overview.month} lookup={lookup} onPress={() => openRecap('month')} prevLabel="last month" compact />
            </View>
            {overview.month.byCategory[0] ? (
              <Text className="text-muted-foreground ml-1 text-[13px]">
                Biggest this month: {overview.month.byCategory[0].name} · {formatMoney(overview.month.byCategory[0].totalMinor, lookup(overview.month.currency))}
              </Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          className="bg-card border-border active:bg-accent mt-2 flex-row items-center justify-center gap-2 rounded-lg border p-3.5"
          onPress={() => router.push('/import')}
        >
          <Icon as={CloudUpload} className="text-primary size-5" />
          <Text className="text-[15px] font-medium">Import a file</Text>
        </Pressable>
      </ScrollView>

      <Pressable
        className="bg-primary absolute bottom-6 right-5 size-14 items-center justify-center rounded-full shadow-lg shadow-black/20 active:opacity-90"
        onPress={() => router.push('/expense/new')}
        accessibilityLabel="Add expense"
      >
        <Icon as={Plus} className="text-primary-foreground size-7" />
      </Pressable>
    </TabScreen>
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
    <Pressable className={cn('bg-card border-border active:bg-accent gap-1 rounded-lg border p-4', compact && 'flex-1')} onPress={onPress}>
      <Text className="text-muted-foreground text-xs uppercase tracking-wide">{label}</Text>
      <Text className={cn('font-bold', compact ? 'text-xl' : 'text-[30px] leading-9')} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(stats.totalMinor, currency)}
      </Text>
      <Text className="text-muted-foreground text-xs">
        {stats.count} item{stats.count === 1 ? '' : 's'}
        {d !== 0 ? ` · ${d > 0 ? '↑' : '↓'} ${formatMoney(Math.abs(d), currency)} vs ${prevLabel}` : ''}
      </Text>
    </Pressable>
  );
}

/** Mirrors the three tiles and the "biggest" hint while the overview loads. */
function TilesSkeleton() {
  return (
    <View className="gap-3" {...loadingA11y}>
      <View className="bg-card border-border gap-2.5 rounded-lg border p-4">
        <SkeletonLine className="w-14" />
        <SkeletonLine className="h-7 w-44" />
        <SkeletonLine className="w-36" />
      </View>
      <View className="flex-row gap-3">
        {[0, 1].map((i) => (
          <View key={i} className="bg-card border-border flex-1 gap-2.5 rounded-lg border p-4">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="h-5 w-24" />
            <SkeletonLine className="w-20" />
          </View>
        ))}
      </View>
      <SkeletonLine className="ml-1 w-56" />
    </View>
  );
}
