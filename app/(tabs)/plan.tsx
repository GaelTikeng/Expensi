import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, SectionList, View } from 'react-native';

import { PlannedListSkeleton } from '@/src/components/skeletons';
import { TabScreen } from '@/src/components/tab-screen';
import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';
import { completePlan } from '@/src/features/planned/completeFlow';
import { CompleteSheet, type CompleteValues } from '@/src/features/planned/CompleteSheet';
import { FixedChargesView } from '@/src/features/planned/FixedChargesView';
import { PlannedRow } from '@/src/features/planned/PlannedRow';
import { PlanningView } from '@/src/features/planned/PlanningView';
import { useUpcomingPlanned } from '@/src/features/planned/usePlanned';
import { invalidate, keys, useRefetchOnFocus } from '@/src/lib/query';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { cn } from '@/src/lib/utils';

type Tab = 'upcoming' | 'planning' | 'fixed';

/** F5.5 / F5.7 / F6.4: Upcoming · Planning · Fixed charges. */
export default function PlanScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { overdue, upcoming, loading, error, reload, api, lookup } = useUpcomingPlanned();
  const [completing, setCompleting] = useState<PlannedDto | null>(null);
  const [busy, setBusy] = useState(false);

  useRefetchOnFocus(keys.planned.all);

  const confirmComplete = async (values: CompleteValues) => {
    if (!completing) return;
    setBusy(true);
    try {
      const res = await completePlan(api, completing, values, getToken);
      setCompleting(null);
      if (res.parked) Alert.alert('Saved', 'The receipt will upload when you are back online.');
      void invalidate.plans(qc);
      void invalidate.expenses(qc);
    } catch (err) {
      Alert.alert('Could not complete', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sections = [
    ...(overdue.length ? [{ key: 'overdue', title: 'Overdue', data: overdue }] : []),
    ...(upcoming.length ? [{ key: 'upcoming', title: 'Upcoming', data: upcoming }] : []),
  ];

  return (
    <TabScreen>
      <ToggleGroup
        type="single"
        value={tab}
        onValueChange={(v) => {
          if (v) setTab(v as Tab);
        }}
        className="bg-muted m-3 rounded-lg p-[3px]"
      >
        {(
          [
            ['upcoming', 'Upcoming'],
            ['planning', 'Planning'],
            ['fixed', 'Fixed charges'],
          ] as const
        ).map(([k, label]) => (
          <ToggleGroupItem
            key={k}
            value={k}
            aria-label={label}
            className={cn('h-9 flex-1 rounded-md', tab === k ? 'bg-card shadow-sm shadow-black/5' : 'bg-transparent')}
          >
            <Text className={cn('text-[13px]', tab === k ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal')}>{label}</Text>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {tab === 'planning' ? <PlanningView lookup={lookup} /> : null}
      {tab === 'fixed' ? <FixedChargesView lookup={lookup} /> : null}

      {tab === 'upcoming' ? (
        loading ? (
          <PlannedListSkeleton header withCheck />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(p) => p.id}
            stickySectionHeadersEnabled
            onRefresh={reload}
            refreshing={false}
            contentContainerClassName={sections.length === 0 ? 'grow' : 'pb-[100px]'}
            renderSectionHeader={({ section }) => (
              <Text
                className={cn(
                  'bg-background px-4 py-2 text-xs font-semibold uppercase',
                  section.key === 'overdue' ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {section.title}
              </Text>
            )}
            renderItem={({ item, section }) => (
              <PlannedRow
                item={item}
                currency={lookup(item.currency)}
                overdue={section.key === 'overdue'}
                onPress={() => router.push(`/planned/${item.id}`)}
                onDone={() => setCompleting(item)}
              />
            )}
            ItemSeparatorComponent={() => <Separator className="ml-[62px]" />}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center gap-2 p-8">
                <Icon as={CalendarDays} className="text-muted-foreground size-10" />
                <Text className="text-[17px] font-semibold">Nothing planned</Text>
                <Text variant="muted" className="text-center">
                  Plan an expense and we will remind you the day before and an hour before.
                </Text>
              </View>
            }
            ListFooterComponent={
              overdue.length ? (
                <Text className="text-muted-foreground p-4 text-center text-xs">Overdue items: tap ✓ to mark paid, or open one to skip it.</Text>
              ) : null
            }
          />
        )
      ) : null}

      {error ? <Text className="text-destructive p-3 text-[13px]">{error}</Text> : null}

      {tab === 'upcoming' ? (
        <Pressable
          className="bg-primary absolute bottom-6 right-5 size-14 items-center justify-center rounded-full shadow-md shadow-black/20 active:bg-primary/90"
          onPress={() => router.push('/planned/new')}
          accessibilityLabel="Plan an expense"
        >
          <Icon as={Plus} className="text-primary-foreground size-7" />
        </Pressable>
      ) : null}

      <CompleteSheet plan={completing} currency={lookup(completing?.currency ?? 'XAF')} busy={busy} onConfirm={confirmComplete} onClose={() => setCompleting(null)} />
    </TabScreen>
  );
}
