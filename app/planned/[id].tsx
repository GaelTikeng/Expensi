import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { plannedApi } from '@/src/features/planned/api';
import { completePlan } from '@/src/features/planned/completeFlow';
import { CompleteSheet, type CompleteValues } from '@/src/features/planned/CompleteSheet';
import { PlannedForm } from '@/src/features/planned/PlannedForm';
import { cancelFor, scheduleFor } from '@/src/features/planned/reminders';
import { useMe } from '@/src/features/settings/useMe';
import { formatMoney } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';

/** F5.6 / F5.8: detail with one-tap "Mark as paid", skip, edit, delete. */
export default function PlannedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const [plan, setPlan] = useState<PlannedDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api
      .get(id)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const skip = () =>
    Alert.alert('Skip this one?', 'It stays in your history as skipped.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip',
        onPress: async () => {
          try {
            setPlan(await api.update(id, { status: 'skipped' }));
            await cancelFor(id);
          } catch (err) {
            Alert.alert('Could not skip', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);

  const unskip = async () => {
    try {
      const p = await api.update(id, { status: 'planned' });
      setPlan(p);
      await scheduleFor(p, lookup(p.currency));
    } catch (err) {
      Alert.alert('Could not restore', err instanceof Error ? err.message : String(err));
    }
  };

  const remove = () =>
    Alert.alert('Delete this plan?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.remove(id);
            await cancelFor(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);

  const confirmComplete = async (values: CompleteValues) => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await completePlan(api, plan, values, getToken);
      setPlan(res.planned);
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
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!plan || catLoading || meLoading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const currency = lookup(plan.currency);
  const when = new Date(plan.scheduledAt);
  const overdue = plan.status === 'planned' && when.getTime() < now;

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
                <Ionicons name="trash-outline" size={22} color="#C0392B" />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.amount}>{formatMoney(plan.amountMinor, currency)}</Text>
          <Text style={[styles.when, overdue && styles.overdue]}>
            {when.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {overdue ? ' · overdue' : ''}
          </Text>
          <Text style={[styles.status, styles[`status_${plan.status}` as const]]}>
            {plan.status === 'done' ? 'Paid' : plan.status === 'skipped' ? 'Skipped' : plan.recurringChargeId ? 'Fixed charge · due' : 'Planned'}
          </Text>
        </View>

        {plan.status === 'planned' ? (
          <Pressable style={styles.primary} onPress={() => setCompleting(true)}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.primaryText}>Mark as paid</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Detail label="Where" value={plan.place} />
          <Detail label="To whom" value={plan.payee} />
          <Detail label="Why" value={plan.reason} />
          <Detail label="Category" value={plan.categoryId ? (categories.find((c) => c.id === plan.categoryId)?.name ?? null) : null} />
          <Detail label="Notes" value={plan.notes} />
        </View>

        {plan.status === 'done' && plan.completedExpenseId ? (
          <Pressable style={styles.link} onPress={() => router.push(`/expense/${plan.completedExpenseId}`)}>
            <Ionicons name="receipt-outline" size={18} color="#1F5EFF" />
            <Text style={styles.linkText}>Open the recorded expense</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          {plan.status === 'planned' ? (
            <>
              <Pressable style={styles.secondary} onPress={() => setEditing(true)}>
                <Text style={styles.secondaryText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={skip}>
                <Text style={styles.secondaryText}>Skip</Text>
              </Pressable>
            </>
          ) : plan.status === 'skipped' ? (
            <Pressable style={styles.secondary} onPress={unskip}>
              <Text style={styles.secondaryText}>Put back in plan</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <CompleteSheet plan={completing ? plan : null} currency={currency} busy={busy} onConfirm={confirmComplete} onClose={() => setCompleting(false)} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  error: { color: '#C0392B' },
  hero: { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', gap: 6 },
  amount: { fontSize: 32, fontWeight: '700' },
  when: { fontSize: 14, color: '#555', textAlign: 'center' },
  overdue: { color: '#E67E22', fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
  status_planned: { color: '#1F5EFF' },
  status_done: { color: '#27AE60' },
  status_skipped: { color: '#95A5A6' },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27AE60', borderRadius: 12, paddingVertical: 16 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  detail: { padding: 12, gap: 2 },
  detailLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase' },
  detailValue: { fontSize: 15 },
  link: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 12 },
  linkText: { color: '#1F5EFF', fontSize: 15 },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D7DAE0' },
  secondaryText: { fontSize: 15, color: '#111' },
});
