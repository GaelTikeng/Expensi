import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Receipt, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';
import { Group } from '@/src/components/group';
import { GroupSkeleton, loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { plannedApi } from '@/src/features/planned/api';
import { completePlan } from '@/src/features/planned/completeFlow';
import { CompleteSheet, type CompleteValues } from '@/src/features/planned/CompleteSheet';
import { PlannedForm } from '@/src/features/planned/PlannedForm';
import { cancelFor, scheduleFor } from '@/src/features/planned/reminders';
import { findCachedPlan } from '@/src/features/planned/usePlanned';
import { useMe } from '@/src/features/settings/useMe';
import { formatMoney } from '@/src/lib/money';
import { errorMessage, invalidate, keys } from '@/src/lib/query';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { cn } from '@/src/lib/utils';

/** F5.6 / F5.8: detail with one-tap "Mark as paid", skip, edit, delete. */
export default function PlannedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const query = useQuery({
    queryKey: keys.planned.detail(id),
    queryFn: () => api.get(id),
    // Open at once with the row the Upcoming list already holds.
    placeholderData: () => findCachedPlan(qc, id),
  });
  const plan = query.data ?? null;
  const error = errorMessage(query.error);
  // Every change here also touches the lists, so write through and mark them stale.
  const setPlan = (p: PlannedDto) => {
    qc.setQueryData(keys.planned.detail(id), p);
    void invalidate.plans(qc);
  };
  const [editing, setEditing] = useState(false);
  const { confirm } = useActionSheets();
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const skip = async () => {
    if (!(await confirm({ title: 'Skip this one?', message: 'It stays in your history as skipped.', actionLabel: 'Skip', destructive: false }))) return;
    try {
      setPlan(await api.update(id, { status: 'skipped' }));
      await cancelFor(id);
    } catch (err) {
      Alert.alert('Could not skip', err instanceof Error ? err.message : String(err));
    }
  };

  const unskip = async () => {
    try {
      const p = await api.update(id, { status: 'planned' });
      setPlan(p);
      await scheduleFor(p, lookup(p.currency));
    } catch (err) {
      Alert.alert('Could not restore', err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this plan?', message: 'Its reminders are cancelled too.', actionLabel: 'Delete' }))) return;
    try {
      await api.remove(id);
      await cancelFor(id);
      void invalidate.plans(qc);
      router.back();
    } catch (err) {
      Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
    }
  };

  const confirmComplete = async (values: CompleteValues) => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await completePlan(api, plan, values, getToken);
      setPlan(res.planned);
      void invalidate.expenses(qc);
      setCompleting(false);
      if (res.parked) Alert.alert('Saved', 'The receipt will upload when you are back online.');
    } catch (err) {
      Alert.alert('Could not complete', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text className="text-destructive">{error}</Text>
      </View>
    );
  }
  if (!plan || catLoading || meLoading || !profile) {
    return <PlannedDetailSkeleton />;
  }

  const currency = lookup(plan.currency);
  const when = new Date(plan.scheduledAt);
  const overdue = plan.status === 'planned' && when.getTime() < now;
  const categoryName = plan.categoryId ? (categories.find((c) => c.id === plan.categoryId)?.name ?? null) : null;
  const rows: [string, string | null | undefined][] = [
    ['Where', plan.place],
    ['To whom', plan.payee],
    ['Why', plan.reason],
    ['Category', categoryName],
    ['Notes', plan.notes],
  ];
  const details = rows.filter((d): d is [string, string] => Boolean(d[1]));

  if (editing) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit plan' }} />
        <PlannedForm
          initial={plan}
          categories={categories}
          currencies={currencies}
          defaultCurrency={profile.defaultCurrency}
          submitLabel="Save changes"
          submitting={submitting}
          onSubmit={async (values) => {
            setSubmitting(true);
            try {
              const { id: _ignored, ...patch } = values;
              const saved = await api.update(id, patch);
              setPlan(saved);
              await scheduleFor(saved, lookup(saved.currency));
              setEditing(false);
            } catch (err) {
              Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: plan.title,
          headerRight: () =>
            plan.status !== 'done' ? (
              <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Delete">
                <Icon as={Trash2} className="text-destructive size-[22px]" />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-12">
        <View className="bg-card border-border items-center gap-1.5 rounded-lg border p-5">
          <Text className="text-[32px] font-bold leading-10">{formatMoney(plan.amountMinor, currency)}</Text>
          <Text className={cn('text-center text-sm', overdue ? 'text-warning font-semibold' : 'text-muted-foreground')}>
            {when.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {overdue ? ' · overdue' : ''}
          </Text>
          <Text
            className={cn(
              'mt-1 text-xs font-semibold uppercase',
              plan.status === 'done' ? 'text-success' : plan.status === 'skipped' ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {plan.status === 'done' ? 'Paid' : plan.status === 'skipped' ? 'Skipped' : plan.recurringChargeId ? 'Fixed charge · due' : 'Planned'}
          </Text>
        </View>

        {plan.status === 'planned' ? (
          <Button size="lg" className="bg-success active:bg-success/90 h-14" onPress={() => setCompleting(true)}>
            <Icon as={CircleCheck} className="text-success-foreground size-[22px]" />
            <Text className="text-success-foreground text-[17px] font-bold">Mark as paid</Text>
          </Button>
        ) : null}

        {details.length ? (
          <Group>
            {details.map(([label, value]) => (
              <Detail key={label} label={label} value={value} />
            ))}
          </Group>
        ) : null}

        {plan.status === 'done' && plan.completedExpenseId ? (
          <Button variant="link" onPress={() => router.push(`/expense/${plan.completedExpenseId}`)}>
            <Icon as={Receipt} className="text-primary size-[18px]" />
            <Text className="text-[15px]">Open the recorded expense</Text>
          </Button>
        ) : null}

        <View className="flex-row gap-3">
          {plan.status === 'planned' ? (
            <>
              <Button variant="outline" size="lg" className="flex-1" onPress={() => setEditing(true)}>
                <Text className="text-[15px]">Edit</Text>
              </Button>
              <Button variant="outline" size="lg" className="flex-1" onPress={skip}>
                <Text className="text-[15px]">Skip</Text>
              </Button>
            </>
          ) : plan.status === 'skipped' ? (
            <Button variant="outline" size="lg" className="flex-1" onPress={unskip}>
              <Text className="text-[15px]">Put back in plan</Text>
            </Button>
          ) : null}
        </View>
      </ScrollView>

      <CompleteSheet plan={completing ? plan : null} currency={currency} busy={busy} onConfirm={confirmComplete} onClose={() => setCompleting(false)} />
    </>
  );
}

/** Mirrors the amount card, "Mark as paid", the details group and the Edit / Skip buttons. */
function PlannedDetailSkeleton() {
  return (
    <View className="bg-background flex-1 gap-3 p-4" {...loadingA11y}>
      <View className="bg-card border-border items-center gap-2.5 rounded-lg border p-5">
        <SkeletonLine className="my-1.5 h-7 w-40" />
        <SkeletonLine className="h-3.5 w-56" />
        <SkeletonLine className="mt-1 w-16" />
      </View>
      <Skeleton className="h-14 rounded-md" />
      <GroupSkeleton rows={3} />
      <View className="flex-row gap-3">
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 flex-1 rounded-md" />
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5 px-4 py-3">
      <Text className="text-muted-foreground text-[11px] uppercase">{label}</Text>
      <Text className="text-[15px]">{value}</Text>
    </View>
  );
}
