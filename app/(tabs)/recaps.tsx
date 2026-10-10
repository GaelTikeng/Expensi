import { useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Button } from '@/src/components/ui/button';
import { TabScreen } from '@/src/components/tab-screen';
import { Card } from '@/src/components/ui/card';
import { Icon } from '@/src/components/ui/icon';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { CategoryBars, DayColumns } from '@/src/features/recaps/charts';
import { useRecap } from '@/src/features/recaps/useRecap';
import { useMe } from '@/src/features/settings/useMe';
import { formatDDMMYYYY, nextPeriodStart, periodLabel, periodStart, previousPeriodStart, todayISO, type RecapPeriod } from '@/src/lib/dates';
import { formatMoney } from '@/src/lib/money';
import { keys, useRefetchOnFocus } from '@/src/lib/query';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

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
  const { recap, loading, narrativeLoading, narrativeError, error, loadNarrative } = useRecap(period, start);
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  useRefetchOnFocus(keys.recaps.all);

  const switchPeriod = (p: RecapPeriod) => {
    setPeriod(p);
    setStart(periodStart(p, todayISO()));
  };
  const today = todayISO();
  const canGoForward = nextPeriodStart(period, start) <= today;

  const s = recap?.stats;
  const currency = lookup(s?.currency ?? 'XAF');

  return (
    <TabScreen>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <ToggleGroup
          type="single"
          value={period}
          // Tapping the active segment reports undefined; treat it as re-selecting
          // that period (jumps back to the current one), as the old segment did.
          onValueChange={(v) => switchPeriod((v as RecapPeriod | undefined) ?? period)}
          className="bg-muted rounded-lg p-[3px]"
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem
              key={p.key}
              value={p.key}
              aria-label={p.label}
              className={cn('h-9 flex-1 rounded-md', period === p.key && 'bg-card shadow-sm shadow-black/5')}
            >
              <Text className={cn('text-sm', period === p.key ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal')}>{p.label}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <View className="flex-row items-center justify-between px-2">
          <Pressable onPress={() => setStart(previousPeriodStart(period, start))} hitSlop={12} accessibilityLabel="Previous period">
            <Icon as={ChevronLeft} className="text-primary" size={22} />
          </Pressable>
          <View className="items-center">
            <Text className="text-[17px] font-semibold">{periodLabel(period, start)}</Text>
            {s ? (
              <Text className="text-muted-foreground text-xs">
                {s.periodStart === s.periodEnd ? formatDDMMYYYY(s.periodStart) : `${formatDDMMYYYY(s.periodStart)} – ${formatDDMMYYYY(s.periodEnd)}`}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => canGoForward && setStart(nextPeriodStart(period, start))}
            hitSlop={12}
            disabled={!canGoForward}
            accessibilityLabel="Next period"
          >
            <Icon as={ChevronRight} className={canGoForward ? 'text-primary' : 'text-muted-foreground opacity-40'} size={22} />
          </Pressable>
        </View>

        {loading && !s ? (
          <RecapSkeleton period={period} />
        ) : error && !s ? (
          <Text className="text-destructive p-4">{error}</Text>
        ) : s ? (
          <>
            <Card className={CARD}>
              <Text className="text-[32px] font-bold leading-10">{formatMoney(s.totalMinor, currency)}</Text>
              <Text className={SUB}>
                {s.count} expense{s.count === 1 ? '' : 's'}
                {s.estimatedCount > 0 ? ` · ${s.estimatedCount} estimated` : ''}
                {s.withProofCount > 0 ? ` · ${s.withProofCount} with proof` : ''}
              </Text>
              <Delta deltaMinor={s.previous.deltaMinor} deltaPct={s.previous.deltaPct} currency={currency} period={period} />
              {s.otherCurrencies.length > 0 ? (
                <Text className={SUB}>
                  Also: {s.otherCurrencies.map((o) => `${formatMoney(o.totalMinor, lookup(o.currency))} (${o.count})`).join(', ')}
                </Text>
              ) : null}
            </Card>

            {period !== 'day' ? (
              <Card className={CARD}>
                <CardLabel>By day</CardLabel>
                <DayColumns days={s.byDay} currency={currency} />
              </Card>
            ) : null}

            {period !== 'day' && s.count > 0 ? (
              <SummaryCard
                // Remount per period so the collapsed state resets when the user navigates.
                key={`${period}-${start}`}
                period={period}
                text={recap?.narrativeMd ?? null}
                loading={narrativeLoading}
                error={narrativeError}
                onRequest={() => void loadNarrative()}
              />
            ) : null}

            {s.byCategory.length > 0 ? (
              <Card className={CARD}>
                <CardLabel>By category</CardLabel>
                <CategoryBars rows={s.byCategory} currency={currency} />
              </Card>
            ) : (
              <Card className={CARD}>
                <Text className={SUB}>Nothing recorded in this period.</Text>
              </Card>
            )}

            {s.fixedMinor > 0 ? (
              <Card className={CARD}>
                <CardLabel>Fixed vs variable</CardLabel>
                <View className="h-2.5 flex-row overflow-hidden rounded-full">
                  <View className="bg-warning" style={{ flex: Math.max(s.fixedMinor, 1) }} />
                  <View className="bg-primary" style={{ flex: Math.max(s.variableMinor, 1) }} />
                </View>
                <Text className={SUB}>
                  Fixed charges {formatMoney(s.fixedMinor, currency)} · everything else {formatMoney(s.variableMinor, currency)}
                </Text>
              </Card>
            ) : null}

            {s.byPayee.length > 0 ? (
              <Card className={CARD}>
                <CardLabel>Top payees</CardLabel>
                {s.byPayee.map((p) => (
                  <View key={p.payee} className={LINE}>
                    <Text className="shrink text-sm" numberOfLines={1}>
                      {p.payee}
                    </Text>
                    <Text className="text-sm font-semibold">{formatMoney(p.totalMinor, currency)}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            {s.largest.length > 0 ? (
              <Card className={CARD}>
                <CardLabel>Largest</CardLabel>
                {s.largest.map((e) => (
                  <View key={e.id} className={LINE}>
                    <View className="flex-1">
                      <Text className="shrink text-sm" numberOfLines={1}>
                        {e.description}
                      </Text>
                      <Text className="text-muted-foreground text-[11px]">
                        {formatDDMMYYYY(e.occurredOn)}
                        {e.categoryName ? ` · ${e.categoryName}` : ''}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold">{formatMoney(e.amountMinor, currency)}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </TabScreen>
  );
}

/** Mirrors the headline, by-day chart, narrative and category cards while stats load. */
function RecapSkeleton({ period }: { period: RecapPeriod }) {
  const columns = period === 'week' ? 7 : 30;
  return (
    <View className="gap-3" {...loadingA11y}>
      <Card className={CARD}>
        <SkeletonLine className="my-1.5 h-7 w-44" />
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-52" />
      </Card>
      {period !== 'day' ? (
        <>
          <Card className={CARD}>
            <SkeletonLine className="mb-1 w-16" />
            <View className="h-[110px] flex-row items-end gap-1">
              {Array.from({ length: columns }, (_, i) => (
                // Fixed pseudo-random heights so the placeholder does not reshuffle on re-render.
                <Skeleton key={i} className="flex-1 rounded-[3px]" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
              ))}
            </View>
          </Card>
          <Card className={cn(CARD, 'bg-accent border-accent')}>
            <SkeletonLine className="w-20" />
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-11/12" />
            <SkeletonLine className="w-3/5" />
          </Card>
        </>
      ) : null}
      <Card className={CARD}>
        <SkeletonLine className="mb-1 w-24" />
        <View className="gap-3">
          {['w-full', 'w-3/4', 'w-1/2', 'w-1/3'].map((bar, i) => (
            <View key={i} className="gap-1.5">
              <View className="flex-row items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <SkeletonLine className="h-3.5 flex-1" />
                <SkeletonLine className="h-3.5 w-16" />
              </View>
              <View className="bg-muted h-1.5 overflow-hidden rounded-[3px]">
                <Skeleton className={cn('h-full rounded-[3px]', bar)} />
              </View>
              <SkeletonLine className="h-2.5 w-28" />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/**
 * F4.3 card. The AI summary is on demand (one model call against the monthly
 * quota); a summary already stored for these stats shows at once, and once
 * shown it can be collapsed to its header.
 */
function SummaryCard({
  period,
  text,
  loading,
  error,
  onRequest,
}: {
  period: RecapPeriod;
  text: string | null;
  loading: boolean;
  error: string | null;
  onRequest: () => void;
}) {
  const theme = useThemeColors();
  const [open, setOpen] = useState(true);
  const header = (
    <View className="flex-row items-center gap-1.5">
      <Icon as={Sparkles} className="text-accent-foreground size-4" />
      <Text className="text-accent-foreground flex-1 text-[13px] font-semibold uppercase">In short</Text>
      {text ? <Icon as={open ? ChevronUp : ChevronDown} className="text-accent-foreground size-[18px]" /> : null}
    </View>
  );
  return (
    <Card className={cn(CARD, 'bg-accent border-accent')}>
      {text ? (
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={8}>
          {header}
        </Pressable>
      ) : (
        header
      )}
      {text ? (
        open ? (
          <Text className="text-[15px] leading-[22px]">{text}</Text>
        ) : null
      ) : loading ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color={theme.accentForeground} />
          <Text className={SUB}>Writing your summary…</Text>
        </View>
      ) : (
        <>
          <Text className={SUB}>Get a short AI summary of this {period}: what moved, where the money went.</Text>
          {error ? <Text className="text-destructive text-[13px]">{error}</Text> : null}
          <Button variant="outline" size="sm" className="border-accent-foreground/40 self-start bg-transparent" onPress={onRequest}>
            <Icon as={Sparkles} className="text-accent-foreground size-4" />
            <Text className="text-accent-foreground">Summarise</Text>
          </Button>
        </>
      )}
    </Card>
  );
}

function Delta({ deltaMinor, deltaPct, currency, period }: { deltaMinor: number; deltaPct: number | null; currency: ReturnType<ReturnType<typeof makeCurrencyLookup>>; period: RecapPeriod }) {
  const prevLabel = period === 'day' ? 'yesterday' : period === 'week' ? 'last week' : 'last month';
  if (deltaMinor === 0) return <Text className={SUB}>Same as {prevLabel}</Text>;
  const up = deltaMinor > 0;
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={up ? ArrowUp : ArrowDown} className={up ? 'text-destructive' : 'text-success'} size={14} />
      <Text className={cn('text-[13px]', up ? 'text-destructive' : 'text-success')}>
        {formatMoney(Math.abs(deltaMinor), currency)}
        {deltaPct != null ? ` (${Math.abs(deltaPct)}%)` : ''} {up ? 'more' : 'less'} than {prevLabel}
      </Text>
    </View>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <Text className="text-muted-foreground mb-1 text-[13px] uppercase tracking-wide">{children}</Text>;
}

const CARD = 'gap-2 rounded-lg p-4 shadow-none';
const SUB = 'text-muted-foreground text-[13px]';
const LINE = 'flex-row items-center justify-between gap-3 py-1';
